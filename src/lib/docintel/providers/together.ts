// ─────────────────────────────────────────────────────────────
// Vision OCR provider — real Document Intelligence backend.
//
// Default backend is Mistral AI (see together.functions resolveVisionConfig).
// Wraps the extractDocumentWithTogether server function behind the
// existing OcrProvider + AiExtractor interfaces so the pipeline
// (and every calling module) is unchanged.
//
// The vision call is unified OCR + extraction — the model returns
// text AND structured fields with bounding boxes in a single call.
// We stash the structured fields inside OcrResult.keyValuePairs and
// cache the full raw response in candidate_documents.ocr_raw so the
// AiExtractor can be a passthrough that re-reads from cache instead
// of paying for the same extraction twice.
// ─────────────────────────────────────────────────────────────
import type {
  AiExtractionResult,
  AiExtractor,
  ExtractedField,
  OcrProvider,
  OcrProviderContext,
  OcrResult,
} from "../types";
import { rasterizeFile, bufferToFile } from "../rasterize";
import { extractDocumentWithTogether, type TogetherExtractResult } from "../together.functions";

/** Default label when the server has not yet reported a provider id. */
const DEFAULT_PROVIDER_NAME = "mistral-vision";
const PROVIDER_VERSION = "v1";

// Namespaced key in OcrResult where we stash the structured fields
// returned by the model so the AiExtractor can reuse them.
const FIELDS_STASH_KEY = "__together_fields__";

interface StashedFields {
  fields: Array<{
    section: string;
    fieldName: string;
    value: string;
    confidence: number;
    page: number;
    bbox: { x: number; y: number; w: number; h: number } | null;
  }>;
  warnings: string[];
  usage: TogetherExtractResult["totalUsage"];
  model: string;
  provider: string;
}

/** Convert model pixel bbox → normalized fraction bbox for storage/UI. */
function normalizeBbox(
  raw: [number, number, number, number] | null | undefined,
  widthPx: number,
  heightPx: number,
): { x: number; y: number; w: number; h: number } | null {
  if (!raw || widthPx <= 0 || heightPx <= 0) return null;
  const [x1, y1, x2, y2] = raw;
  const x = Math.max(0, Math.min(1, x1 / widthPx));
  const y = Math.max(0, Math.min(1, y1 / heightPx));
  const w = Math.max(0, Math.min(1 - x, (x2 - x1) / widthPx));
  const h = Math.max(0, Math.min(1 - y, (y2 - y1) / heightPx));
  return { x, y, w, h };
}

function buildOcrResult(
  res: TogetherExtractResult,
): OcrResult & { [FIELDS_STASH_KEY]?: StashedFields } {
  const providerName = res.provider || DEFAULT_PROVIDER_NAME;
  const blocks = res.pages.map((p) => ({
    page: p.pageNumber,
    text: p.text,
    bbox: { x: 0, y: 0, w: 1, h: 1 },
    confidence: 1,
  }));
  const stash: StashedFields = {
    fields: res.pages.flatMap((p) =>
      p.fields.map((f) => ({
        section: f.section,
        fieldName: f.field_name,
        value: f.value,
        confidence: f.confidence,
        page: f.page_number,
        bbox: normalizeBbox(f.bounding_box ?? null, p.widthPx, p.heightPx),
      })),
    ),
    warnings: res.pages.flatMap((p) => p.warnings ?? []).concat(res.errors),
    usage: res.totalUsage,
    model: res.model,
    provider: providerName,
  };
  return {
    provider: providerName,
    version: PROVIDER_VERSION,
    processedAt: res.processedAt,
    pageCount: res.pages.length,
    text: res.pages.map((p) => p.text).join("\n\n---\n\n"),
    blocks,
    keyValuePairs: [],
    tables: [],
    [FIELDS_STASH_KEY]: stash,
  };
}

export const togetherAiProvider: OcrProvider = {
  name: DEFAULT_PROVIDER_NAME,
  version: PROVIDER_VERSION,
  async extract(ctx: OcrProviderContext, fileBytes: ArrayBuffer): Promise<OcrResult> {
    const file = bufferToFile(fileBytes, ctx.fileName, ctx.mimeType);
    const pages = await rasterizeFile(file);
    // Guess a doc type hint from filename — the server function passes it
    // to the model as context (not a code branch).
    const docTypeHint = ctx.fileName.replace(/\.[^.]+$/, "").toLowerCase();
    const result = await extractDocumentWithTogether({
      data: {
        candidateId: ctx.candidateId,
        documentId: ctx.documentId,
        docType: docTypeHint,
        fileName: ctx.fileName,
        pages: pages.map((p) => ({
          pageNumber: p.pageNumber,
          dataUrl: p.dataUrl,
          widthPx: p.widthPx,
          heightPx: p.heightPx,
        })),
      },
    });
    return buildOcrResult(result);
  },
};

export const togetherAiExtractor: AiExtractor = {
  name: DEFAULT_PROVIDER_NAME,
  version: PROVIDER_VERSION,
  async extract(candidateId, documents): Promise<AiExtractionResult> {
    const fields: ExtractedField[] = [];
    const warnings: AiExtractionResult["warnings"] = [];
    let modelName = DEFAULT_PROVIDER_NAME;

    for (const d of documents) {
      const stash = (d.ocr as unknown as { [FIELDS_STASH_KEY]?: StashedFields })[FIELDS_STASH_KEY];
      if (!stash) continue;
      if (stash.provider) modelName = stash.provider;
      else if (stash.model) modelName = stash.model;
      for (const f of stash.fields) {
        fields.push({
          section: f.section,
          fieldName: f.fieldName,
          value: f.value,
          confidence: f.confidence,
          page: f.page,
          bbox: f.bbox ?? undefined,
          documentId: d.documentId,
        });
      }
      for (const w of stash.warnings) {
        warnings.push({ code: "model_warning", message: w });
      }
    }

    // Same-candidate consistency checks (never cross-candidate).
    const byField = (name: string) =>
      Array.from(
        new Set(
          fields
            .filter((f) => f.fieldName === name)
            .map((f) => f.value.trim().toLowerCase())
            .filter(Boolean),
        ),
      );

    for (const key of ["dob", "nationality", "passport_no", "first_name", "last_name"]) {
      const distinct = byField(key);
      if (distinct.length > 1) {
        warnings.push({
          code: "cross_document_mismatch",
          message: `Field "${key}" differs across this candidate's documents: ${distinct.join(" | ")}`,
          fieldName: key,
        });
      }
    }

    // Silence unused var for typechecker while making intent explicit.
    void candidateId;

    return {
      model: modelName,
      modelVersion: PROVIDER_VERSION,
      processedAt: new Date().toISOString(),
      fields,
      warnings,
    };
  },
};
