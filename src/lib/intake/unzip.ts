// ─────────────────────────────────────────────────────────────
// ZIP expansion for batch intake.
//
// The upload UI accepts .zip files, but the OCR pipeline only
// understands real documents (PDF / images / DOCX). This module
// expands ZIPs in the browser BEFORE persistence, so every inner
// document flows through the normal storage → OCR → extraction
// path like any other uploaded file. Folder structure inside the
// ZIP is preserved in `path` so candidate grouping keeps working.
// ─────────────────────────────────────────────────────────────
import JSZip from "jszip";
import type { UploadedFile } from "@/components/intake/UploadStep";

const SUPPORTED_INNER = /\.(pdf|docx?|png|jpe?g|webp|heic|tiff?|txt|rtf)$/i;
const JUNK = /__MACOSX|\.DS_Store|(^|\/)\./;

export interface ZipExpansionResult {
  files: UploadedFile[];
  /** Human-readable notes, e.g. "archive.zip: skipped 3 unsupported entries". */
  notes: string[];
  /** ZIPs that could not be read at all. */
  errors: string[];
}

function kindOfInner(name: string): UploadedFile["kind"] {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|webp|heic|tiff?)$/.test(n)) return "image";
  if (/\.(docx?|txt|rtf)$/.test(n)) return "doc";
  return "other";
}

/**
 * Infer a real MIME type from the file extension.
 * JSZip's `entry.async("blob")` always returns a Blob with an EMPTY type,
 * so without this every extracted file would be `application/octet-stream`
 * and would be rejected downstream by validateFile (bad_mime) — which is
 * exactly the "has an unsupported type" failure seen in production.
 */
function mimeOfInner(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (/\.jpe?g$/.test(n)) return "image/jpeg";
  if (n.endsWith(".webp")) return "image/webp";
  if (/\.tiff?$/.test(n)) return "image/tiff";
  if (n.endsWith(".heic")) return "image/heic";
  if (n.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (n.endsWith(".doc")) return "application/msword";
  if (n.endsWith(".txt")) return "text/plain";
  if (n.endsWith(".rtf")) return "application/rtf";
  return "application/octet-stream";
}

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `zip-${Date.now()}-${idCounter}`;
}

/**
 * Expands every .zip in the input into its supported inner files.
 * Non-zip files pass through untouched. Nested ZIPs are reported
 * as skipped (one expansion level is enough for agency uploads).
 */
export async function expandZipUploads(input: UploadedFile[]): Promise<ZipExpansionResult> {
  const files: UploadedFile[] = [];
  const notes: string[] = [];
  const errors: string[] = [];

  for (const item of input) {
    if (item.kind !== "zip") {
      files.push(item);
      continue;
    }

    let zip: JSZip;
    try {
      // ArrayBuffer works in every JSZip environment (browser + test runners);
      // passing the File/Blob directly is browser-only.
      zip = await JSZip.loadAsync(await item.file.arrayBuffer());
    } catch {
      errors.push(`${item.name}: not a readable ZIP archive`);
      continue;
    }

    let extracted = 0;
    let skipped = 0;
    const zipBase = item.name.replace(/\.zip$/i, "");

    for (const [entryName, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      if (JUNK.test(entryName)) continue;
      if (entryName.toLowerCase().endsWith(".zip")) {
        skipped += 1;
        continue; // nested archives are not expanded
      }
      if (!SUPPORTED_INNER.test(entryName)) {
        skipped += 1;
        continue;
      }

      try {
        const blob = await entry.async("blob");
        const baseName = entryName.split("/").pop() ?? entryName;
        const innerFile = new File([blob], baseName, {
          // JSZip blobs carry no type — derive it from the extension so
          // validation, storage contentType, and signed-URL preview all work.
          type: mimeOfInner(baseName),
        });
        files.push({
          id: nextId(),
          name: innerFile.name,
          size: innerFile.size,
          kind: kindOfInner(innerFile.name),
          // Preserve the archive's folder structure so groupFilesByFolder
          // still groups per candidate correctly.
          path: `${zipBase}/${entryName}`,
          file: innerFile,
        });
        extracted += 1;
      } catch {
        skipped += 1;
      }
    }

    if (extracted > 0) {
      notes.push(
        `${item.name}: extracted ${extracted} document${extracted === 1 ? "" : "s"}` +
          (skipped > 0 ? `, skipped ${skipped}` : ""),
      );
    } else {
      errors.push(`${item.name}: no supported documents found inside`);
    }
  }

  return { files, notes, errors };
}
