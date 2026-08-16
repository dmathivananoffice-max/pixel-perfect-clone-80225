// ─────────────────────────────────────────────────────────────
// Sprint 5 – Document Intelligence Engine
// Provider-agnostic types. All OCR/AI providers implement these.
// ─────────────────────────────────────────────────────────────

/** Bounding box in document coordinate space (x, y, width, height as fractions 0..1 of the page). */
export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A single OCR-detected block of text with position + confidence. */
export interface OcrBlock {
  page: number;
  text: string;
  bbox: BBox;
  confidence: number; // 0..1
}

/** Raw OCR output for a whole document. Stored verbatim on candidate_documents.ocr_raw. */
export interface OcrResult {
  provider: string; // e.g. "stub", "google-document-ai"
  version: string; // provider version identifier
  processedAt: string; // ISO
  pageCount: number;
  text: string; // full concatenated text
  blocks: OcrBlock[];
  keyValuePairs?: Array<{
    key: string;
    value: string;
    confidence: number;
    page: number;
    bbox?: BBox;
  }>;
  tables?: Array<{ page: number; rows: string[][] }>;
}

export interface OcrProviderContext {
  candidateId: string;
  documentId: string;
  storagePath: string;
  mimeType: string | null;
  fileName: string;
}

/**
 * A single extracted field with full source traceability.
 * Written to public.document_extractions.
 */
export interface ExtractedField {
  section: string; // e.g. "identity", "language", "education"
  fieldName: string; // canonical key, e.g. "passport_number"
  value: string;
  confidence: number; // 0..1
  page: number;
  bbox?: BBox;
  documentId: string; // source document
}

/** Structured AI extraction result. Only OCR text goes into the LLM, never raw PDFs. */
export interface AiExtractionResult {
  model: string; // e.g. "stub-heuristic-v1"
  modelVersion: string;
  processedAt: string;
  fields: ExtractedField[];
  /** Non-fatal warnings the AI wants the human to notice. Never blocks. */
  warnings: Array<{ code: string; message: string; fieldName?: string }>;
}

/** Contract every OCR provider must implement. */
export interface OcrProvider {
  readonly name: string;
  readonly version: string;
  extract(ctx: OcrProviderContext, fileBytes: ArrayBuffer): Promise<OcrResult>;
}

/** Contract for the AI extraction layer (LLM working over OCR text only). */
export interface AiExtractor {
  readonly name: string;
  readonly version: string;
  extract(
    candidateId: string,
    documents: Array<{ documentId: string; docType: string; ocr: OcrResult }>,
  ): Promise<AiExtractionResult>;
}

/** Low-confidence threshold below which a field is auto-flagged for manual review. */
export const LOW_CONFIDENCE_THRESHOLD = 0.65;

/** File validation limits enforced before OCR is even attempted. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
export const ALLOWED_MIME_TYPES: readonly string[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
  "image/heic",
  // Word documents — the upload UI accepts .doc/.docx and the storage
  // bucket allows them. They are stored and previewable; the vision OCR
  // rasterizer does not render them, so they are marked ocr_status=failed
  // per-document (isolated) instead of blocking the candidate's other docs.
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/rtf",
];
