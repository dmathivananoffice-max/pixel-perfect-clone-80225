// ─────────────────────────────────────────────────────────────
// Together AI server function — the ONLY place TOGETHER_API_KEY
// is touched. Every call goes through here so we can swap the
// provider (Anthropic, OpenAI, Vertex, etc.) without changing
// any calling code.
//
// Isolation invariants enforced server-side:
//   • The caller must be authenticated (requireSupabaseAuth).
//   • The (candidateId, documentId) pair must resolve to a row
//     the caller can see under RLS. If it doesn't, we refuse to
//     call the model at all — no cross-candidate leakage possible.
//
// Input protocol:
//   The client rasterizes the file to per-page PNG data URLs and
//   posts them here. We never accept a storage_path from the client
//   and re-download it under service role, because that would
//   bypass RLS.
// ─────────────────────────────────────────────────────────────
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeExtractionField } from "./form-schema";
import { buildMasterOcrPrompt } from "./master-prompt";

const PageInput = z.object({
  pageNumber: z.number().int().positive(),
  dataUrl: z.string().min(32),
  widthPx: z.number().int().positive(),
  heightPx: z.number().int().positive(),
});

const ExtractInput = z.object({
  candidateId: z.string().min(8),
  documentId: z.string().min(8),
  docType: z.string().min(1),
  fileName: z.string().min(1),
  pages: z.array(PageInput).min(1).max(12),
});

export interface TogetherFieldRaw {
  section: string;
  field_name: string;
  value: string;
  confidence: number; // 0..1
  page_number: number;
  bounding_box?: [number, number, number, number] | null; // [x1,y1,x2,y2] pixel coords
}

export interface TogetherPageRaw {
  pageNumber: number;
  widthPx: number;
  heightPx: number;
  text: string;
  fields: TogetherFieldRaw[];
  warnings?: string[];
  /** Full model response for this page, JSON-stringified so it round-trips through the RPC boundary. */
  rawJson: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null;
}

export interface TogetherExtractResult {
  model: string;
  processedAt: string;
  documentId: string;
  candidateId: string;
  docType: string;
  fileName: string;
  pages: TogetherPageRaw[];
  totalUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  errors: string[];
}

function buildPrompt(docType: string, fileName: string, pageNumber: number): string {
  return buildMasterOcrPrompt(docType, fileName, pageNumber);
}

function metadataWarnings(meta: unknown): string[] {
  if (!meta || typeof meta !== "object") return [];
  const m = meta as Record<string, unknown>;
  const out: string[] = [];
  const pick = (k: string, label: string) => {
    const v = m[k];
    if (typeof v === "string" && v.trim()) out.push(`${label}: ${v.trim()}`);
    if (typeof v === "boolean" && v) out.push(`${label}: true`);
  };
  pick("document_title", "document_title");
  pick("certificate_number", "certificate_number");
  pick("registration_number", "registration_number");
  pick("institution_name", "institution_name");
  pick("institution_address", "institution_address");
  pick("signatory_name", "signatory_name");
  pick("signatory_designation", "signatory_designation");
  pick("issue_date", "metadata_issue_date");
  pick("qr_code_present", "qr_code_present");
  pick("barcode_present", "barcode_present");
  pick("stamp_present", "stamp_present");
  pick("signature_present", "signature_present");
  return out.map((s) => `metadata:${s}`);
}

function parsePageFields(
  raw: unknown,
  pageNumber: number,
): { fields: TogetherFieldRaw[]; warnings: string[]; text: string; documentType?: string } {
  const v = (raw && typeof raw === "object" ? raw : {}) as {
    text?: string;
    fields?: unknown[];
    extractions?: unknown[];
    warnings?: unknown[];
    document_type?: string;
    document_metadata?: unknown;
    quality?: { requires_manual_review?: boolean; image_quality?: string; ocr_quality?: string };
  };

  const warnings: string[] = Array.isArray(v.warnings) ? v.warnings.map(String) : [];
  warnings.push(...metadataWarnings(v.document_metadata));
  if (v.document_type) warnings.push(`document_type:${v.document_type}`);
  if (v.quality?.requires_manual_review) warnings.push("requires_manual_review");
  if (v.quality?.image_quality) warnings.push(`image_quality:${v.quality.image_quality}`);
  if (v.quality?.ocr_quality) warnings.push(`ocr_quality:${v.quality.ocr_quality}`);

  // Prefer new `extractions` array; fall back to legacy `fields`.
  const rawList = Array.isArray(v.extractions)
    ? v.extractions
    : Array.isArray(v.fields)
      ? v.fields
      : [];

  const fields: TogetherFieldRaw[] = [];
  for (const item of rawList) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const normalized = normalizeExtractionField({
      section: row.section,
      field_name: row.field_name,
      value: row.value,
      confidence: row.confidence,
      evidence: row.evidence,
      bounding_box: row.bounding_box,
      page_number: row.page_number ?? pageNumber,
    });
    if (!normalized) continue;
    // Drop very low-confidence values (prefer omit + warn).
    if (normalized.confidence > 0 && normalized.confidence < 0.6) {
      warnings.push(
        `low_confidence_omitted:${normalized.section}.${normalized.field_name}=${normalized.confidence}`,
      );
      continue;
    }
    if (normalized.evidence) {
      warnings.push(`evidence:${normalized.section}.${normalized.field_name}:${normalized.evidence}`);
    }
    fields.push({
      section: normalized.section,
      field_name: normalized.field_name,
      value: normalized.value,
      confidence: normalized.confidence,
      page_number: pageNumber,
      bounding_box: normalized.bounding_box ?? null,
    });
  }

  return {
    fields,
    warnings,
    text: typeof v.text === "string" ? v.text : "",
    documentType: typeof v.document_type === "string" ? v.document_type : undefined,
  };
}

function stripFences(s: string): string {
  const t = s.trim();
  if (t.startsWith("```")) {
    return t
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```$/, "")
      .trim();
  }
  return t;
}

function safeParse(content: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(stripFences(content)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function callTogether(
  apiKey: string,
  baseUrl: string,
  model: string,
  prompt: string,
  imageDataUrl: string,
): Promise<{ content: string; usage?: TogetherPageRaw["usage"] }> {
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
    temperature: 0,
    max_tokens: 6144,
    response_format: { type: "json_object" as const },
  };

  // Exponential backoff on 429 / 5xx.
  const maxAttempts = 4;
  const requestTimeoutMs = 45_000;
  let lastErr = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      lastErr = timedOut
        ? `Vision request timed out after ${Math.round(requestTimeoutMs / 1000)}s`
        : error instanceof Error
          ? error.message
          : String(error);
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
        continue;
      }
      break;
    }
    if (res.ok) {
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: TogetherPageRaw["usage"];
      };
      const content = json.choices?.[0]?.message?.content ?? "";
      return { content, usage: json.usage };
    }
    const text = await res.text().catch(() => "");
    lastErr = `Together AI ${res.status}: ${text.slice(0, 500)}`;
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
  }
  throw new Error(lastErr || "Together AI call failed");
}

// ── Multimodal preflight ──────────────────────────────────────
// Verifies the configured model actually accepts image input before we
// spend time rasterizing pages and burning tokens. Cached per-model so we
// only pay the cost once per server instance.
const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

type PreflightResult =
  | { ok: true; model: string }
  | { ok: false; model: string; reason: string; status?: number };

const preflightCache = new Map<string, Promise<PreflightResult>>();

async function preflightVisionModel(
  apiKey: string,
  baseUrl: string,
  model: string,
): Promise<PreflightResult> {
  const cached = preflightCache.get(model);
  if (cached) return cached;
  const run = (async (): Promise<PreflightResult> => {
    const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "ok" },
              { type: "image_url", image_url: { url: TINY_PNG_DATA_URL } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return { ok: true, model };
    const text = (await res.text().catch(() => "")).slice(0, 800);
    const lower = text.toLowerCase();
    let reason = `Together AI ${res.status}: ${text}`;
    if (lower.includes("multimodal not supported")) {
      reason = `Model "${model}" does not accept image input (multimodal not supported). Set TOGETHER_VISION_MODEL to a vision-language endpoint (e.g. a dedicated endpoint for Qwen2.5-VL / Qwen3-VL).`;
    } else if (lower.includes("model_not_available") || lower.includes("non-serverless")) {
      reason = `Model "${model}" is not serverless on this account. Create a dedicated endpoint on Together AI and set TOGETHER_VISION_MODEL to that endpoint ID.`;
    } else if (res.status === 401 || res.status === 403) {
      reason = `Together AI rejected the API key (${res.status}). Check TOGETHER_API_KEY.`;
    } else if (res.status === 404) {
      reason = `Model/endpoint "${model}" not found (404). Verify TOGETHER_VISION_MODEL.`;
    }
    return { ok: false, model, reason, status: res.status };
  })();
  preflightCache.set(model, run);
  const result = await run;
  // Don't cache transient/server failures — allow retry after backoff.
  if (!result.ok && (result.status === 429 || (result.status ?? 0) >= 500)) {
    preflightCache.delete(model);
  }
  return result;
}

/**
 * Resolve the vision backend. Together AI is used when TOGETHER_API_KEY is
 * configured; otherwise we fall back to the built-in Lovable AI gateway,
 * which needs no user-supplied key.
 */
function resolveVisionConfig(): {
  apiKey: string | undefined;
  baseUrl: string;
  model: string;
  needsPreflight: boolean;
  missingMessage: string;
} {
  // Mistral is the default OCR/vision backend.
  const mistralKey = process.env.MISTRAL_API_KEY;
  if (mistralKey) {
    return {
      apiKey: mistralKey,
      baseUrl: process.env.MISTRAL_API_BASE_URL ?? "https://api.mistral.ai/v1",
      model: process.env.MISTRAL_VISION_MODEL ?? "mistral-medium-latest",
      needsPreflight: false,
      missingMessage: "MISTRAL_API_KEY is not configured on the server.",
    };
  }
  const togetherKey = process.env.TOGETHER_API_KEY;
  if (togetherKey) {
    return {
      apiKey: togetherKey,
      baseUrl: process.env.TOGETHER_API_BASE_URL ?? "https://api.together.ai/v1",
      model: process.env.TOGETHER_VISION_MODEL ?? "Qwen/Qwen2.5-VL-72B-Instruct",
      needsPreflight: true,
      missingMessage: "TOGETHER_API_KEY is not configured on the server.",
    };
  }
  return {
    apiKey: process.env.LOVABLE_API_KEY,
    baseUrl: "https://ai.gateway.lovable.dev/v1",
    model: process.env.LOVABLE_VISION_MODEL ?? "google/gemini-2.5-flash",
    needsPreflight: false,
    missingMessage:
      "No OCR vision backend is configured (needs LOVABLE_API_KEY or TOGETHER_API_KEY).",
  };
}

/** Public server fn so the UI can validate vision config on demand. */
export const validateTogetherVisionModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<PreflightResult & { baseUrl: string }> => {
    const { apiKey, baseUrl, model, missingMessage } = resolveVisionConfig();
    if (!apiKey) {
      return { ok: false, model, reason: missingMessage, baseUrl };
    }
    preflightCache.delete(model); // bypass cache for on-demand validation
    const r = await preflightVisionModel(apiKey, baseUrl, model);
    return { ...r, baseUrl };
  });

export const extractDocumentWithTogether = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ExtractInput.parse(input))
  .handler(async ({ data, context }): Promise<TogetherExtractResult> => {
    const { apiKey, baseUrl, model, needsPreflight, missingMessage } = resolveVisionConfig();
    if (!apiKey) throw new Error(missingMessage);

    // ISOLATION GATE: verify the doc belongs to the caller-visible candidate BEFORE any model call.
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

    const pagesOut: TogetherPageRaw[] = [];
    const errors: string[] = [];
    const totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    // Preflight: bail out early if the configured model can't accept images.
    if (needsPreflight) {
      const pf = await preflightVisionModel(apiKey, baseUrl, model);
      if (!pf.ok) throw new Error(`Vision model preflight failed: ${pf.reason}`);
    }


    const processPage = async (page: (typeof data.pages)[number]) => {
      const prompt = buildPrompt(data.docType, data.fileName, page.pageNumber);
      try {
        const { content, usage } = await callTogether(apiKey, baseUrl, model, prompt, page.dataUrl);
        if (usage) {
          totalUsage.prompt_tokens += usage.prompt_tokens ?? 0;
          totalUsage.completion_tokens += usage.completion_tokens ?? 0;
          totalUsage.total_tokens += usage.total_tokens ?? 0;
        }
        const parsed = safeParse(content);
        if (!parsed.ok) {
          errors.push(`Page ${page.pageNumber}: invalid JSON — ${parsed.error}`);
          pagesOut.push({
            pageNumber: page.pageNumber,
            widthPx: page.widthPx,
            heightPx: page.heightPx,
            text: "",
            fields: [],
            warnings: [`invalid_json:${parsed.error}`],
            rawJson: JSON.stringify({ rawContent: content }),
            usage: usage
              ? {
                  prompt_tokens: usage.prompt_tokens ?? 0,
                  completion_tokens: usage.completion_tokens ?? 0,
                  total_tokens: usage.total_tokens ?? 0,
                }
              : null,
          });
          return;
        }
        const pageParsed = parsePageFields(parsed.value, page.pageNumber);
        pagesOut.push({
          pageNumber: page.pageNumber,
          widthPx: page.widthPx,
          heightPx: page.heightPx,
          text: pageParsed.text,
          fields: pageParsed.fields,
          warnings: pageParsed.warnings,
          rawJson: JSON.stringify(parsed.value),
          usage: usage
            ? {
                prompt_tokens: usage.prompt_tokens ?? 0,
                completion_tokens: usage.completion_tokens ?? 0,
                total_tokens: usage.total_tokens ?? 0,
              }
            : null,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Page ${page.pageNumber}: ${msg}`);
        pagesOut.push({
          pageNumber: page.pageNumber,
          widthPx: page.widthPx,
          heightPx: page.heightPx,
          text: "",
          fields: [],
          warnings: [`page_failed:${msg}`],
          rawJson: "null",
        });
      }
    };

    // Process two pages at a time. This removes the long serial wait for
    // multi-page PDFs while keeping memory and provider load bounded.
    const queue = [...data.pages];
    const workers = Array.from({ length: Math.min(2, queue.length) }, async () => {
      while (queue.length > 0) {
        const page = queue.shift();
        if (!page) break;
        await processPage(page);
      }
    });
    await Promise.all(workers);
    pagesOut.sort((a, b) => a.pageNumber - b.pageNumber);

    return {
      model,
      processedAt: new Date().toISOString(),
      documentId: data.documentId,
      candidateId: data.candidateId,
      docType: data.docType,
      fileName: data.fileName,
      pages: pagesOut,
      totalUsage,
      errors,
    };
  });
