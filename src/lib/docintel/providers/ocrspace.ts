// ─────────────────────────────────────────────────────────────
// OCR.Space provider — quick-swap OCR backend.
//
// Production hardening (client-side, before hitting the server fn):
//   • Whitelist MIME/extension. Unsupported files are rejected as
//     "skipped" errors so the pipeline can continue.
//   • Enforce OCR.Space Free tier 1.5 MB ceiling. Images larger than
//     720 KB are auto-compressed (JPEG re-encode + downscale). PDFs
//     above the limit surface a clean "OCR.Space Free limit exceeded"
//     error and are marked failed — never silently hung.
//   • Every call is logged: filename, mime, bytes in/out, elapsed ms,
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
import { extractDocumentWithOcrSpace } from "../ocrspace.functions";

const PROVIDER_NAME = "ocrspace";
const PROVIDER_VERSION = "v1";

// OCR.Space Free plan hard cap = 1 MB for base64Image POST body.
// Base64 inflates ~1.37×, so keep source bytes ≤ ~720 KB to stay
// under the 1 MB body after encoding + form overhead.
const RAW_BYTE_SOFT_LIMIT = 720_000;
const RAW_BYTE_HARD_LIMIT = 1_000_000;

const ALLOWED_MIME = new Set<string>([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff",
]);

/** Per-document observability record for one OCR attempt. */
export interface OcrDocumentLog {
  fileName: string;
  mimeType: string;
  originalBytes: number;
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
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "bmp":
      return "image/bmp";
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

/**
 * Downscale + JPEG-encode an image blob to fit under `targetBytes`.
 * Returns null if the environment can't decode the image (e.g. TIFF
 * in a browser without native support).
 */
async function compressImage(
  bytes: ArrayBuffer,
  mime: string,
  targetBytes: number,
): Promise<{ bytes: ArrayBuffer; mime: string } | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image decode failed"));
      el.src = url;
    });

    let { width, height } = img;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Try progressively smaller scales + JPEG qualities until under target.
    const scales = [1, 0.85, 0.7, 0.55, 0.4, 0.3];
    const qualities = [0.85, 0.75, 0.65, 0.5, 0.4];
    for (const scale of scales) {
      const w = Math.max(600, Math.round(width * scale));
      const h = Math.max(600, Math.round(height * scale));
      canvas.width = w;
      canvas.height = h;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      for (const q of qualities) {
        const outBlob: Blob | null = await new Promise((r) =>
          canvas.toBlob((b) => r(b), "image/jpeg", q),
        );
        if (!outBlob) continue;
        if (outBlob.size <= targetBytes) {
          const buf = await outBlob.arrayBuffer();
          return { bytes: buf, mime: "image/jpeg" };
        }
      }
    }
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const ocrSpaceProvider: OcrProvider & { __lastLog?: OcrDocumentLog } = {
  name: PROVIDER_NAME,
  version: PROVIDER_VERSION,
  async extract(ctx: OcrProviderContext, fileBytes: ArrayBuffer): Promise<OcrResult> {
    const started = performance.now();
    const originalMime = ctx.mimeType ?? null;
    const mime = normaliseMime(originalMime, ctx.fileName);
    const originalBytes = fileBytes.byteLength;

    const docLog: OcrDocumentLog = {
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

    const logBase = {
      file: ctx.fileName,
      mime,
      originalMime,
      originalBytes,
    };
    console.info("[ocrspace] request", logBase);

    let sendBytes = fileBytes;
    let sendMime = mime;

    try {
      // 0. Zero-byte guard — empty files hang or garbage-return at OCR.Space.
      if (originalBytes === 0) {
        const msg = "File is empty (0 bytes).";
        console.warn("[ocrspace] skipped", { ...logBase, status: "skipped", reason: msg });
        docLog.finalStatus = "skipped";
        docLog.errorMessage = msg;
        throw new Error(`OCR skipped — ${msg}`);
      }

      // 1. MIME whitelist — reject unsupported.
      if (!ALLOWED_MIME.has(mime)) {
        const msg = `Unsupported file type "${mime}" (only PDF / PNG / JPG / WEBP / GIF / BMP / TIFF).`;
        console.warn("[ocrspace] skipped", { ...logBase, status: "skipped", reason: msg });
        docLog.finalStatus = "skipped";
        docLog.errorMessage = msg;
        throw new Error(`OCR skipped — ${msg}`);
      }

      // 2. Size gate + auto-compress for images.
      if (sendBytes.byteLength > RAW_BYTE_SOFT_LIMIT) {
        if (mime.startsWith("image/")) {
          docLog.compressionAttempted = true;
          const compressed = await compressImage(sendBytes, mime, RAW_BYTE_SOFT_LIMIT).catch(
            () => null,
          );
          if (compressed) {
            sendBytes = compressed.bytes;
            sendMime = compressed.mime;
            docLog.compressedBytes = sendBytes.byteLength;
            console.info("[ocrspace] compressed", {
              ...logBase,
              afterBytes: sendBytes.byteLength,
              asMime: sendMime,
            });
          }
        }
        // No client-side PDF compression available — PDFs above the
        // limit fall through to the hard-limit failure below.
      }

      if (sendBytes.byteLength > RAW_BYTE_HARD_LIMIT) {
        const msg = "OCR.Space Free limit exceeded (1.5 MB).";
        console.warn("[ocrspace] failed", {
          ...logBase,
          finalBytes: sendBytes.byteLength,
          status: "failed",
          reason: msg,
        });
        docLog.finalStatus = "failed";
        docLog.errorMessage = msg;
        throw new Error(msg);
      }

      const dataUrl = toDataUrl(sendBytes, sendMime);

      try {
        const res = await extractDocumentWithOcrSpace({
          data: {
            candidateId: ctx.candidateId,
            documentId: ctx.documentId,
            fileName: ctx.fileName,
            mimeType: sendMime,
            dataUrl,
          },
        });

        docLog.ocrResponseReceived = new Date().toISOString();

        const blocks = res.pages.map((p) => ({
          page: p.pageNumber,
          text: p.text,
          bbox: { x: 0, y: 0, w: 1, h: 1 },
          confidence: 1,
        }));

        const elapsedMs = Math.round(performance.now() - started);
        console.info("[ocrspace] success", {
          ...logBase,
          sentBytes: sendBytes.byteLength,
          pages: res.pages.length,
          chars: res.fullText.length,
          elapsedMs,
          status: "success",
        });
        docLog.finalStatus = "success";

        return {
          provider: PROVIDER_NAME,
          version: PROVIDER_VERSION,
          processedAt: res.processedAt,
          pageCount: res.pages.length || 1,
          text: res.fullText,
          blocks,
          keyValuePairs: [],
          tables: [],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...({ __ocrspace_raw__: res.rawJson, __ocrspace_errors__: res.errors } as any),
        };
      } catch (err) {
        const elapsedMs = Math.round(performance.now() - started);
        const message = err instanceof Error ? err.message : String(err);
        console.error("[ocrspace] failed", {
          ...logBase,
          sentBytes: sendBytes.byteLength,
          elapsedMs,
          status: "failed",
          reason: message,
          stack: err instanceof Error ? err.stack : undefined,
        });
        docLog.finalStatus = "failed";
        docLog.errorMessage = message;
        throw err;
      }
    } catch (err) {
      // Ensure the log carries the message for any path that threw
      // before the inner catch (skip / hard-limit paths set it above).
      if (!docLog.errorMessage) {
        docLog.errorMessage = err instanceof Error ? err.message : String(err);
      }
      throw err;
    } finally {
      docLog.elapsedMs = Math.round(performance.now() - started);
      ocrSpaceProvider.__lastLog = docLog;
    }
  },
};

/**
 * Minimal text-based AI extractor for OCR.Space.
 * Pulls a few obvious fields via regex so the Verification Studio has
 * something to render. Swap in an LLM-backed extractor later without
 * touching the pipeline.
 */
export const ocrSpaceExtractor: AiExtractor = {
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
