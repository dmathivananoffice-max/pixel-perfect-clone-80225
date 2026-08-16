// ─────────────────────────────────────────────────────────────
// Google Document AI provider — production OCR backend.
//
// Client-side gate before hitting the server fn:
//   • Whitelist MIME/extension: PDF / PNG / JPEG / TIFF (the
//     formats configured for the processor). Unsupported files are
//     rejected as "skipped" errors so the pipeline can continue.
//   • Enforce the 20 MB synchronous-processing ceiling with a
//     clear failure — never silently hung.
//   • Every call is logged: filename, mime, bytes, elapsed ms,
//     final status. The last log is exposed as `__lastLog` so the
//     pipeline can build a per-batch processing summary.
// ─────────────────────────────────────────────────────────────
import type {
  AiExtractionResult,
  AiExtractor,
  ExtractedField,
  OcrProvider,
  OcrProviderContext,
  OcrResult,
} from "../types";
import { extractDocumentWithGoogleDocAI } from "../google.functions";

const PROVIDER_NAME = "google-document-ai";
const PROVIDER_VERSION = "v1";

// Synchronous Document AI processing accepts raw documents up to 20 MB.
const RAW_BYTE_HARD_LIMIT = 20 * 1_024 * 1_024;

const ALLOWED_MIME = new Set<string>([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/tiff",
]);

/** Per-document observability record for one OCR attempt. */
export interface GoogleDocAIDocumentLog {
  fileName: string;
  mimeType: string;
  originalBytes: number;
  /** Always false — Document AI needs no client-side compression (20 MB ceiling). */
  compressionAttempted: boolean;
  compressedBytes: number | null;
  ocrRequestStarted: string;
  ocrResponseReceived: string | null;
  httpStatus: number | null;
  elapsedMs: number;
  finalStatus: "success" | "failed" | "skipped";
  errorMessage: string | null;
}

function normaliseMime(mime: string | null | undefined, fileName: string): string {
  const m = (mime ?? "").toLowerCase().trim();
  if (m && ALLOWED_MIME.has(m)) return m;
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "tif":
    case "tiff":
      return "image/tiff";
    default:
      return m || "application/octet-stream";
  }
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + CHUNK)) as unknown as number[],
    );
  }
  return btoa(binary);
}

function toDataUrl(bytes: ArrayBuffer, mime: string): string {
  return `data:${mime};base64,${arrayBufferToBase64(bytes)}`;
}

export const googleDocAIProvider: OcrProvider & { __lastLog?: GoogleDocAIDocumentLog } = {
  name: PROVIDER_NAME,
  version: PROVIDER_VERSION,
  async extract(ctx: OcrProviderContext, fileBytes: ArrayBuffer): Promise<OcrResult> {
    const started = performance.now();
    const mime = normaliseMime(ctx.mimeType, ctx.fileName);
    const originalBytes = fileBytes.byteLength;

    const docLog: GoogleDocAIDocumentLog = {
      fileName: ctx.fileName,
      mimeType: mime,
      originalBytes,
      compressionAttempted: false,
      compressedBytes: null,
      ocrRequestStarted: new Date().toISOString(),
      ocrResponseReceived: null,
      httpStatus: null,
      elapsedMs: 0,
      finalStatus: "failed",
      errorMessage: null,
    };

    console.info("[google-docai] request", {
      file: ctx.fileName,
      mime,
      originalBytes,
    });

    try {
      // 0. Zero-byte guard.
      if (originalBytes === 0) {
        const msg = "File is empty (0 bytes).";
        console.warn("[google-docai] skipped", { file: ctx.fileName, reason: msg });
        docLog.finalStatus = "skipped";
        docLog.errorMessage = msg;
        throw new Error(`OCR skipped — ${msg}`);
      }

      // 1. MIME whitelist — PDF / PNG / JPEG / TIFF only.
      if (!ALLOWED_MIME.has(mime)) {
        const msg = `Unsupported file type "${mime}" (only PDF / PNG / JPEG / TIFF).`;
        console.warn("[google-docai] skipped", { file: ctx.fileName, mime, reason: msg });
        docLog.finalStatus = "skipped";
        docLog.errorMessage = msg;
        throw new Error(`OCR skipped — ${msg}`);
      }

      // 2. Size gate — synchronous processing ceiling.
      if (originalBytes > RAW_BYTE_HARD_LIMIT) {
        const msg = "Google Document AI limit exceeded (20 MB per document).";
        console.warn("[google-docai] failed", { file: ctx.fileName, originalBytes, reason: msg });
        docLog.finalStatus = "failed";
        docLog.errorMessage = msg;
        throw new Error(msg);
      }

      const dataUrl = toDataUrl(fileBytes, mime);

      const res = await extractDocumentWithGoogleDocAI({
        data: {
          candidateId: ctx.candidateId,
          documentId: ctx.documentId,
          fileName: ctx.fileName,
          mimeType: mime,
          dataUrl,
        },
      });

      docLog.ocrResponseReceived = new Date().toISOString();

      const blocks = res.pages.map((p) => ({
        page: p.pageNumber,
        text: p.text,
        bbox: { x: 0, y: 0, w: 1, h: 1 },
        confidence: res.confidence ?? 1,
      }));

      const elapsedMs = Math.round(performance.now() - started);
      console.info("[google-docai] success", {
        file: ctx.fileName,
        sentBytes: originalBytes,
        pages: res.pageCount,
        chars: res.fullText.length,
        detectedLanguage: res.detectedLanguage,
        confidence: res.confidence,
        elapsedMs,
      });
      docLog.finalStatus = "success";

      return {
        provider: PROVIDER_NAME,
        version: PROVIDER_VERSION,
        processedAt: res.processedAt,
        pageCount: res.pageCount || 1,
        text: res.fullText,
        blocks,
        keyValuePairs: [],
        tables: [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...({
          __google_docai_raw__: res.rawJson,
          __google_docai_language__: res.detectedLanguage,
          __google_docai_confidence__: res.confidence,
          __google_docai_elapsed_ms__: res.elapsedMs,
        } as any),
      };
    } catch (err) {
      if (!docLog.errorMessage) {
        const message = err instanceof Error ? err.message : String(err);
        docLog.errorMessage = message;
        if (/^OCR skipped/i.test(message)) docLog.finalStatus = "skipped";
        console.error("[google-docai] failed", {
          file: ctx.fileName,
          mime,
          reason: message,
          stack: err instanceof Error ? err.stack : undefined,
        });
      }
      throw err;
    } finally {
      docLog.elapsedMs = Math.round(performance.now() - started);
      googleDocAIProvider.__lastLog = docLog;
    }
  },
};

/**
 * Text-based AI extractor — identical field-extraction logic to the
 * previous provider (regex over OCR text). Prompts and logic are
 * unchanged; only the provider label differs.
 */
export const googleDocAIExtractor: AiExtractor = {
  name: PROVIDER_NAME,
  version: PROVIDER_VERSION,
  async extract(candidateId, documents): Promise<AiExtractionResult> {
    void candidateId;
    const fields: ExtractedField[] = [];
    const warnings: AiExtractionResult["warnings"] = [];

    for (const d of documents) {
      const text = d.ocr.text ?? "";
      if (!text.trim()) {
        warnings.push({ code: "empty_ocr", message: `No OCR text for document ${d.documentId}` });
        continue;
      }

      fields.push({
        section: "general",
        fieldName: "raw_ocr_text",
        value: text.slice(0, 20000),
        confidence: 1,
        page: 1,
        documentId: d.documentId,
      });

      const push = (
        section: string,
        fieldName: string,
        value: string | undefined,
        confidence = 0.7,
      ) => {
        if (!value) return;
        fields.push({
          section,
          fieldName,
          value: value.trim(),
          confidence,
          page: 1,
          documentId: d.documentId,
        });
      };

      push("contact", "email", text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0]);
      push("contact", "phone", text.match(/\+?\d[\d\s().-]{7,}\d/)?.[0]);
      push(
        "personal",
        "dob",
        text.match(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/)?.[1],
        0.5,
      );
      push("passport", "passport_no", text.match(/\b([A-Z]{1,2}\d{6,9})\b/)?.[1], 0.5);
    }

    return {
      model: PROVIDER_NAME,
      modelVersion: PROVIDER_VERSION,
      processedAt: new Date().toISOString(),
      fields,
      warnings,
    };
  },
};
