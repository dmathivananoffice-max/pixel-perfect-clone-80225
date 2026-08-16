// ─────────────────────────────────────────────────────────────
// Google Document AI server function.
// Sole place GOOGLE_* credentials are touched — they never reach
// the browser. Same isolation contract as ocrspace.functions.ts:
// caller must be authenticated and the (candidateId, documentId)
// pair must be visible to them under RLS.
//
// Auth: service-account JWT (RS256) signed with WebCrypto — no
// Node-only Google SDK dependency, so this runs on any Nitro
// preset (Node / Cloudflare Workers / edge).
// ─────────────────────────────────────────────────────────────
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ExtractInput = z.object({
  candidateId: z.string().min(8),
  documentId: z.string().min(8),
  fileName: z.string().min(1),
  mimeType: z.string().nullable().optional(),
  /** data URL, e.g. "data:application/pdf;base64,JVBERi0..." */
  dataUrl: z.string().min(32),
});

export interface GoogleDocAIPage {
  pageNumber: number;
  text: string;
}

export interface GoogleDocAIResult {
  provider: "google-document-ai";
  processedAt: string;
  candidateId: string;
  documentId: string;
  fileName: string;
  pages: GoogleDocAIPage[];
  fullText: string;
  pageCount: number;
  /** Top detected language code (e.g. "en", "de"), if reported. */
  detectedLanguage: string | null;
  /** Mean page layout confidence 0..1, if reported. */
  confidence: number | null;
  elapsedMs: number;
  /** JSON-stringified trimmed raw response for debug display. */
  rawJson: string;
  errors: string[];
}

// Synchronous Document AI processing accepts raw documents up to 20 MB.
const GOOGLE_DOCAI_HARD_LIMIT = 20 * 1_024 * 1_024;
// Generous ceiling for multi-page scanned PDFs — never hang forever.
const GOOGLE_DOCAI_FETCH_TIMEOUT_MS = 120_000;
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CLOUD_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

const VALID_DATA_URL = /^data:(application\/pdf|image\/(png|jpe?g|tiff));base64,/i;

// ---------- helpers ----------

function dataUrlToBase64(dataUrl: string): string {
  const idx = dataUrl.indexOf(",");
  return idx < 0 ? "" : dataUrl.slice(idx + 1);
}

function dataUrlByteLength(dataUrl: string): number {
  const b64 = dataUrlToBase64(dataUrl);
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

function bytesToB64Url(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + CHUNK)) as unknown as number[],
    );
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function stringToB64Url(s: string): string {
  return bytesToB64Url(new TextEncoder().encode(s));
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** PEM (with or without escaped \n) → WebCrypto RS256 signing key. */
async function importServiceAccountKey(rawKey: string): Promise<CryptoKey> {
  const pem = rawKey.replace(/\\n/g, "\n");
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  if (!body) throw new Error("GOOGLE_PRIVATE_KEY is empty or malformed.");
  const der = base64ToBytes(body);
  return crypto.subtle.importKey(
    "pkcs8",
    der.buffer as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

// Best-effort token cache — tokens live 1h, refresh 5 min early.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getGoogleAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60_000) {
    return cachedToken.token;
  }
  const now = Math.floor(Date.now() / 1000);
  const unsigned =
    `${stringToB64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.` +
    stringToB64Url(
      JSON.stringify({
        iss: clientEmail,
        scope: CLOUD_SCOPE,
        aud: OAUTH_TOKEN_URL,
        iat: now,
        exp: now + 3600,
      }),
    );
  const key = await importServiceAccountKey(privateKey);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${bytesToB64Url(new Uint8Array(sig))}`;

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google OAuth token exchange failed (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("Google OAuth returned no access_token.");
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

// ---------- Document AI response types (trimmed) ----------

interface DocAITextSegment {
  startIndex?: string | number;
  endIndex?: string | number;
}

interface DocAIPage {
  pageNumber?: number;
  layout?: {
    confidence?: number;
    textAnchor?: { textSegments?: DocAITextSegment[] };
  };
  detectedLanguages?: Array<{ languageCode?: string; confidence?: number }>;
}

interface DocAIProcessResponse {
  document?: {
    text?: string;
    pages?: DocAIPage[];
  };
  error?: { code?: number; message?: string };
}

function pageText(fullText: string, page: DocAIPage): string {
  const segments = page.layout?.textAnchor?.textSegments ?? [];
  if (segments.length === 0) return "";
  return segments
    .map((s) => {
      const start = Number(s.startIndex ?? 0);
      const end = Number(s.endIndex ?? fullText.length);
      return fullText.slice(start, end);
    })
    .join("");
}

// ---------- server function ----------

export const extractDocumentWithGoogleDocAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ExtractInput.parse(input))
  .handler(async ({ data, context }): Promise<GoogleDocAIResult> => {
    const started = Date.now();

    const projectId = process.env.GOOGLE_PROJECT_ID;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const location = process.env.GOOGLE_LOCATION || "europe-west2";
    const processorId = process.env.GOOGLE_PROCESSOR_ID;
    if (!projectId || !clientEmail || !privateKey || !processorId) {
      throw new Error(
        "Google Document AI is not configured on the server (need GOOGLE_PROJECT_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_PROCESSOR_ID).",
      );
    }

    // Isolation gate — same as OCR.Space / Together.
    const { data: doc, error } = await context.supabase
      .from("candidate_documents")
      .select("id, candidate_id")
      .eq("id", data.documentId)
      .eq("candidate_id", data.candidateId)
      .maybeSingle();
    if (error) throw new Error(`Isolation check failed: ${error.message}`);
    if (!doc) {
      throw new Error(
        `Refused: document ${data.documentId} does not belong to candidate ${data.candidateId} for this user.`,
      );
    }

    if (!VALID_DATA_URL.test(data.dataUrl)) {
      throw new Error(
        `OCR skipped — invalid data URL for "${data.fileName}" (expected PDF / PNG / JPEG / TIFF).`,
      );
    }

    const rawBytes = dataUrlByteLength(data.dataUrl);
    const mimeType = data.dataUrl.slice(5, data.dataUrl.indexOf(";"));
    console.info("[google-docai/server] request_started", {
      file: data.fileName,
      mime: mimeType,
      rawBytes,
      processor: processorId,
      location,
      at: new Date().toISOString(),
    });

    if (rawBytes > GOOGLE_DOCAI_HARD_LIMIT) {
      throw new Error("Google Document AI limit exceeded (20 MB per document).");
    }

    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);

    const url =
      `https://${location}-documentai.googleapis.com/v1/` +
      `projects/${projectId}/locations/${location}/processors/${processorId}:process`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GOOGLE_DOCAI_FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rawDocument: {
            content: dataUrlToBase64(data.dataUrl),
            mimeType,
          },
        }),
        signal: controller.signal,
      });
    } catch (e) {
      const msg =
        e instanceof Error && e.name === "AbortError"
          ? `Google Document AI timed out after ${GOOGLE_DOCAI_FETCH_TIMEOUT_MS / 1000}s.`
          : `Google Document AI request failed: ${e instanceof Error ? e.message : String(e)}`;
      console.warn("[google-docai/server] fetch_failed", { file: data.fileName, reason: msg });
      throw new Error(msg);
    } finally {
      clearTimeout(timer);
    }

    const elapsedMs = Date.now() - started;
    console.info("[google-docai/server] response_received", {
      file: data.fileName,
      httpStatus: res.status,
      elapsedMs,
      at: new Date().toISOString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[google-docai/server] http_error", {
        file: data.fileName,
        status: res.status,
        elapsedMs,
        body: text.slice(0, 300),
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error(
          `Google Document AI auth failed (HTTP ${res.status}) — check service account + processor permissions.`,
        );
      }
      if (res.status === 400 && /page/i.test(text)) {
        throw new Error(
          "Google Document AI: document exceeds the synchronous page limit — split the PDF and retry.",
        );
      }
      throw new Error(`Google Document AI HTTP ${res.status}: ${text.slice(0, 500)}`);
    }

    const json = (await res.json()) as DocAIProcessResponse;
    if (json.error?.message) {
      throw new Error(`Google Document AI: ${json.error.message}`);
    }

    const fullText = json.document?.text ?? "";
    const docPages = json.document?.pages ?? [];
    const pages: GoogleDocAIPage[] = docPages.map((p, i) => ({
      pageNumber: p.pageNumber ?? i + 1,
      text: pageText(fullText, p),
    }));
    if (pages.length === 0) {
      pages.push({ pageNumber: 1, text: fullText });
    }

    // Top detected language across all pages.
    let detectedLanguage: string | null = null;
    let bestLangConf = 0;
    for (const p of docPages) {
      for (const l of p.detectedLanguages ?? []) {
        if (l.languageCode && (l.confidence ?? 0) > bestLangConf) {
          bestLangConf = l.confidence ?? 0;
          detectedLanguage = l.languageCode;
        }
      }
    }

    // Mean page layout confidence, if reported.
    const confs = docPages
      .map((p) => p.layout?.confidence)
      .filter((c): c is number => typeof c === "number");
    const confidence =
      confs.length > 0 ? confs.reduce((a, c) => a + c, 0) / confs.length : null;

    console.info("[google-docai/server] success", {
      file: data.fileName,
      pages: pages.length,
      chars: fullText.length,
      detectedLanguage,
      confidence,
      elapsedMs: Date.now() - started,
    });

    return {
      provider: "google-document-ai",
      processedAt: new Date().toISOString(),
      candidateId: data.candidateId,
      documentId: data.documentId,
      fileName: data.fileName,
      pages,
      fullText,
      pageCount: pages.length,
      detectedLanguage,
      confidence,
      elapsedMs: Date.now() - started,
      rawJson: JSON.stringify(json).slice(0, 100_000),
      errors: [],
    };
  });
