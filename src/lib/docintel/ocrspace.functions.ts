// ─────────────────────────────────────────────────────────────
// OCR.Space server function.
// Sole place OCR_SPACE_API_KEY is touched. Same isolation contract
// as together.functions.ts: caller must be authenticated and the
// (candidateId, documentId) pair must be visible to them under RLS.
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

export interface OcrSpacePage {
  pageNumber: number;
  text: string;
}

export interface OcrSpaceResult {
  provider: "ocrspace";
  processedAt: string;
  candidateId: string;
  documentId: string;
  fileName: string;
  pages: OcrSpacePage[];
  fullText: string;
  /** JSON-stringified raw response from OCR.Space for debug display. */
  rawJson: string;

  errors: string[];
}

function fileTypeFromMime(mime: string | null | undefined, fileName: string): string | null {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("pdf")) return "PDF";
  if (m.includes("png")) return "PNG";
  if (m.includes("jpeg") || m.includes("jpg")) return "JPG";
  if (m.includes("gif")) return "GIF";
  if (m.includes("tiff")) return "TIF";
  if (m.includes("bmp")) return "BMP";
  if (m.includes("webp")) return "WEBP";
  const ext = fileName.split(".").pop()?.toUpperCase();
  if (ext && ["PDF", "PNG", "JPG", "JPEG", "GIF", "TIF", "TIFF", "BMP", "WEBP"].includes(ext)) {
    return ext === "JPEG" ? "JPG" : ext === "TIFF" ? "TIF" : ext;
  }
  return null;
}

// OCR.Space Free plan hard cap for base64Image POST body.
const OCRSPACE_FREE_HARD_LIMIT = 1_024 * 1_024;

function dataUrlByteLength(dataUrl: string): number {
  const idx = dataUrl.indexOf(",");
  if (idx < 0) return 0;
  const b64 = dataUrl.slice(idx + 1);
  // 4 base64 chars → 3 bytes, minus padding.
  const pad = (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
  return Math.floor((b64.length * 3) / 4) - pad;
}

const VALID_DATA_URL = /^data:(application\/pdf|image\/(png|jpe?g|webp|gif|bmp|tiff));base64,/i;

export const extractDocumentWithOcrSpace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ExtractInput.parse(input))
  .handler(async ({ data, context }): Promise<OcrSpaceResult> => {
    const started = Date.now();
    const apiKey = process.env.OCR_SPACE_API_KEY;
    if (!apiKey) throw new Error("OCR_SPACE_API_KEY is not configured on the server.");

    // Isolation gate — same as Together.
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

    // Reject malformed / unsupported data URLs before hitting OCR.Space.
    if (!VALID_DATA_URL.test(data.dataUrl)) {
      throw new Error(
        `OCR skipped — invalid data URL for "${data.fileName}" (expected PDF or image).`,
      );
    }

    const rawBytes = dataUrlByteLength(data.dataUrl);
    console.info("[ocrspace/server] request", {
      file: data.fileName,
      mime: data.mimeType,
      rawBytes,
    });

    if (rawBytes > OCRSPACE_FREE_HARD_LIMIT) {
      throw new Error("OCR.Space Free limit exceeded (1.5 MB).");
    }

    const filetype = fileTypeFromMime(data.mimeType ?? null, data.fileName);

    const form = new URLSearchParams();
    form.set("base64Image", data.dataUrl);
    form.set("language", "eng");
    form.set("isOverlayRequired", "false");
    form.set("scale", "true");
    form.set("OCREngine", "2");
    form.set("detectOrientation", "true");
    if (filetype) form.set("filetype", filetype);

    const res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: {
        apikey: apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const elapsedMs = Date.now() - started;
      console.warn("[ocrspace/server] http_error", {
        file: data.fileName,
        status: res.status,
        elapsedMs,
        body: text.slice(0, 300),
      });
      if (res.status === 413 || /E556|too large/i.test(text)) {
        throw new Error("OCR.Space Free limit exceeded (1.5 MB).");
      }
      throw new Error(`OCR.Space HTTP ${res.status}: ${text.slice(0, 500)}`);
    }

    const json = (await res.json()) as {
      ParsedResults?: Array<{ ParsedText?: string; ErrorMessage?: string }>;
      IsErroredOnProcessing?: boolean;
      ErrorMessage?: string | string[];
      ErrorDetails?: string;
      OCRExitCode?: number;
    };

    const errors: string[] = [];
    if (json.IsErroredOnProcessing) {
      const em = Array.isArray(json.ErrorMessage)
        ? json.ErrorMessage.join("; ")
        : json.ErrorMessage ?? "unknown error";
      errors.push(em);
      if (json.ErrorDetails) errors.push(json.ErrorDetails);
    }

    const pages: OcrSpacePage[] = (json.ParsedResults ?? []).map((r, i) => ({
      pageNumber: i + 1,
      text: r.ParsedText ?? "",
    }));

    // If OCR.Space returned no pages and an error, surface it.
    if (pages.length === 0 && errors.length > 0) {
      const joined = errors.join(" | ");
      if (/E556|too large/i.test(joined)) {
        throw new Error("OCR.Space Free limit exceeded (1.5 MB).");
      }
      throw new Error(`OCR.Space: ${joined}`);
    }

    const fullText = pages.map((p) => p.text).join("\n\n---\n\n");

    console.info("[ocrspace/server] success", {
      file: data.fileName,
      pages: pages.length,
      chars: fullText.length,
      elapsedMs: Date.now() - started,
    });

    return {
      provider: "ocrspace",
      processedAt: new Date().toISOString(),
      candidateId: data.candidateId,
      documentId: data.documentId,
      fileName: data.fileName,
      pages,
      fullText,
      rawJson: JSON.stringify(json),
      errors,
    };
  });
