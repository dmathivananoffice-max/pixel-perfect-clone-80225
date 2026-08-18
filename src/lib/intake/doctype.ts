// ─────────────────────────────────────────────────────────────
// Filename-based document type guessing.
// Delegates to the single document-type registry so the classifier,
// the upload checklist, the mapper and the document rail can never
// drift apart (the "No passport bio page uploaded" class of bug).
// ─────────────────────────────────────────────────────────────
import { classifyDocument, canonicalDocType } from "@/intake/documentTypes";

/** Guess a registry document-type id from a filename (and optional folder). */
export function guessDocType(name: string, folder?: string): string {
  const res = classifyDocument({ fileName: name, folderName: folder });
  return canonicalDocType(res.type);
}
