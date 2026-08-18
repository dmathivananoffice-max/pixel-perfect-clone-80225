// ─────────────────────────────────────────────────────────────
// File fingerprinting + validation.
// Every upload goes through this layer before touching storage.
// ─────────────────────────────────────────────────────────────
import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES } from "./types";

/** SHA-256 hex digest of a File, using WebCrypto (no external deps). */
export async function computeSha256(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

export interface FileValidationError {
  code: "too_large" | "bad_mime" | "empty" | "suspicious_name";
  message: string;
}

/**
 * Pre-OCR file gate. Blocks obviously invalid files without ever
 * writing them to storage or sending them to a provider.
 */
export function validateFile(file: File): FileValidationError | null {
  if (file.size === 0) return { code: "empty", message: `${file.name} is empty (0 bytes).` };
  if (file.size > MAX_FILE_BYTES) {
    return { code: "too_large", message: `${file.name} exceeds the 25 MB limit.` };
  }
  const mime = (file.type || "").toLowerCase();
  if (mime && !ALLOWED_MIME_TYPES.includes(mime)) {
    return { code: "bad_mime", message: `${file.name} has an unsupported type (${mime}).` };
  }
  // Reject obviously malicious double-extensions like "cv.pdf.exe".
  if (/\.(exe|bat|cmd|sh|scr|js|vbs|ps1)$/i.test(file.name)) {
    return { code: "suspicious_name", message: `${file.name} has a disallowed extension.` };
  }
  return null;
}

/** Deterministic, ASCII-safe filename for storage paths. */
export function standardizeFilename(original: string): string {
  const clean = original
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
  return clean.length > 120 ? clean.slice(-120) : clean;
}
