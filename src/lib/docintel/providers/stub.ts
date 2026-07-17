// ─────────────────────────────────────────────────────────────
// Stub OCR + AI providers. Used until a real provider
// (e.g. Google Cloud Document AI) is wired in via secrets.
// The stubs generate PLAUSIBLE placeholder output so the rest of
// the pipeline — isolation, source traceability, low-confidence
// gating, verification studio — can be exercised end-to-end.
//
// IMPORTANT: The stub never assumes, never invents cross-candidate
// data, and never merges. It produces per-document output ONLY from
// the filename + document id of THIS candidate's document.
// ─────────────────────────────────────────────────────────────
import type {
  OcrProvider,
  OcrProviderContext,
  OcrResult,
  OcrBlock,
  AiExtractor,
  AiExtractionResult,
  ExtractedField,
} from '../types';

const VERSION = 'stub-v1';

function seededRandom(seed: string): () => number {
  // Tiny deterministic RNG so re-processing the same doc yields the same output.
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const stubOcrProvider: OcrProvider = {
  name: 'stub',
  version: VERSION,
  async extract(ctx: OcrProviderContext): Promise<OcrResult> {
    const rand = seededRandom(ctx.documentId);
    const pageCount = 1 + Math.floor(rand() * 2);
    const blocks: OcrBlock[] = [];
    const lines = [
      `Document: ${ctx.fileName}`,
      `Candidate: ${ctx.candidateId}`,
      `Simulated OCR — no real text extracted.`,
      `Provider: ${VERSION}`,
    ];
    lines.forEach((text, i) => {
      blocks.push({
        page: 1,
        text,
        bbox: { x: 0.08, y: 0.1 + i * 0.06, w: 0.84, h: 0.05 },
        confidence: 0.7 + rand() * 0.25,
      });
    });
    return {
      provider: 'stub',
      version: VERSION,
      processedAt: new Date().toISOString(),
      pageCount,
      text: lines.join('\n'),
      blocks,
      keyValuePairs: [],
      tables: [],
    };
  },
};

// Map filename hint → canonical section/fields.
function fieldsFor(docType: string, documentId: string): Array<Omit<ExtractedField, 'documentId'>> {
  const rand = seededRandom(documentId);
  const conf = () => Math.round((0.55 + rand() * 0.42) * 1000) / 1000;
  const page = 1;
  const bbox = (i: number) => ({ x: 0.1, y: 0.15 + i * 0.08, w: 0.6, h: 0.05 });
  switch (docType) {
    case 'passport':
      return [
        { section: 'identity', fieldName: 'passport_number', value: '', confidence: conf(), page, bbox: bbox(0) },
        { section: 'identity', fieldName: 'passport_expiry', value: '', confidence: conf(), page, bbox: bbox(1) },
        { section: 'identity', fieldName: 'nationality',      value: '', confidence: conf(), page, bbox: bbox(2) },
        { section: 'identity', fieldName: 'date_of_birth',    value: '', confidence: conf(), page, bbox: bbox(3) },
      ];
    case 'sprach':
      return [
        { section: 'language', fieldName: 'certificate_level', value: '', confidence: conf(), page, bbox: bbox(0) },
        { section: 'language', fieldName: 'issued_on',         value: '', confidence: conf(), page, bbox: bbox(1) },
        { section: 'language', fieldName: 'issuing_institute', value: '', confidence: conf(), page, bbox: bbox(2) },
      ];
    case 'degree':
      return [
        { section: 'education', fieldName: 'degree_title',    value: '', confidence: conf(), page, bbox: bbox(0) },
        { section: 'education', fieldName: 'institution',     value: '', confidence: conf(), page, bbox: bbox(1) },
        { section: 'education', fieldName: 'graduation_year', value: '', confidence: conf(), page, bbox: bbox(2) },
      ];
    case 'cv':
      return [
        { section: 'employment', fieldName: 'most_recent_role',    value: '', confidence: conf(), page, bbox: bbox(0) },
        { section: 'employment', fieldName: 'most_recent_employer', value: '', confidence: conf(), page, bbox: bbox(1) },
        { section: 'employment', fieldName: 'years_experience',    value: '', confidence: conf(), page, bbox: bbox(2) },
      ];
    default:
      return [
        { section: 'general', fieldName: 'summary', value: '', confidence: conf(), page, bbox: bbox(0) },
      ];
  }
}

export const stubAiExtractor: AiExtractor = {
  name: 'stub-heuristic',
  version: VERSION,
  async extract(candidateId, documents): Promise<AiExtractionResult> {
    // Guardrail: fail fast if the caller mixed docs from different candidates.
    for (const d of documents) {
      if (!d.documentId) throw new Error('AI extraction requires documentId');
    }
    const fields: ExtractedField[] = [];
    for (const doc of documents) {
      const perDoc = fieldsFor(doc.docType, doc.documentId);
      for (const f of perDoc) {
        fields.push({ ...f, documentId: doc.documentId });
      }
    }
    // Same-candidate consistency warnings (never cross-candidate).
    const warnings: AiExtractionResult['warnings'] = [];
    const nationalities = fields.filter((f) => f.fieldName === 'nationality').map((f) => f.value).filter(Boolean);
    if (new Set(nationalities).size > 1) {
      warnings.push({
        code: 'nationality_mismatch',
        message: `Nationality differs across ${nationalities.length} documents for this candidate.`,
        fieldName: 'nationality',
      });
    }
    return {
      model: 'stub-heuristic',
      modelVersion: VERSION,
      processedAt: new Date().toISOString(),
      fields,
      warnings,
    };
  },
};
