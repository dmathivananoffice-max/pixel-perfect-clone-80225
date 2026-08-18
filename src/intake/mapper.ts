// ─────────────────────────────────────────────────────────────
// THE MAPPER — pure, synchronous, no I/O, fully unit-testable.
// Extractor output → canonical namespaced fields. Never drops a
// value: anything unresolved lands in the `unmapped` bucket (R3).
// ─────────────────────────────────────────────────────────────
import { FIELD_DICTIONARY, FIELD_BY_KEY, type FieldDef } from "./fieldDictionary";
import { applyNormaliser } from "./normalisers";
import { parseMrz } from "./mrz";
import { canonicalDocType } from "./documentTypes";

export type FieldStatus =
  | "empty"
  | "ai_high"
  | "ai_medium"
  | "ai_low"
  | "needs_review"
  | "conflict"
  | "human_edited"
  | "verified";

export interface RawExtractedField {
  /** Name emitted by the model, e.g. "surname" or "given_names". */
  name: string;
  /** Optional section hint emitted by the model. */
  section?: string | null;
  value: string;
  confidence: number;
  page?: number;
  bbox?: { x: number; y: number; w: number; h: number } | null;
  rawText?: string;
}

export interface MappedValue {
  key: string; // namespaced canonical key
  section: string;
  fieldKey: string;
  value: string; // normalised
  rawValue: string; // exactly as extracted
  confidence: number;
  status: FieldStatus;
  flags: string[];
  note?: string;
  documentId: string;
  docType: string;
  source: "mrz" | "model";
  page?: number;
  bbox?: { x: number; y: number; w: number; h: number } | null;
  snippet?: string;
}

export interface UnmappedValue {
  name: string;
  value: string;
  confidence: number;
  documentId: string;
  docType: string;
  reason: "no_alias" | "ambiguous" | "doc_not_authorised";
}

export interface MapDocumentInput {
  documentId: string;
  docType: string;
  ocrText?: string;
  fields: RawExtractedField[];
}

export interface MapDocumentResult {
  mapped: MappedValue[];
  unmapped: UnmappedValue[];
  reviewItems: Array<{ code: string; message: string; options?: string[] }>;
  mrzPresent: boolean;
  mrzChecksumValid: boolean;
  /** extracted name → resolved key (or null) — powers the debug panel. */
  trace: Array<{
    extracted: string;
    resolved: string | null;
    outcome: string;
    rawValue?: string;
    normalisedValue?: string;
  }>;
}

export function normaliseKeyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s\-.]+/g, "_")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/__+/g, "_");
}

function camelSplit(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

/** Resolve an extractor field name to a canonical namespaced key. */
export function resolveKey(
  extractedName: string,
  documentType: string,
  ctx?: { sectionHint?: string | null; snippet?: string },
): { key: string | null; reason?: UnmappedValue["reason"]; ambiguous?: FieldDef[] } {
  const docType = canonicalDocType(documentType);
  const norm = normaliseKeyName(camelSplit(extractedName));

  const matches = (f: FieldDef) =>
    f.fieldKey === norm || f.aliases.some((a) => normaliseKeyName(a) === norm);

  const nameMatches = FIELD_DICTIONARY.filter(matches);
  if (nameMatches.length === 0) return { key: null, reason: "no_alias" };

  // Explicit section hint from the model wins when it is a real match.
  const hint = (ctx?.sectionHint ?? "").trim().toLowerCase();
  const hinted = nameMatches.filter((f) => f.section === hint);
  const pool = hinted.length > 0 ? hinted : nameMatches;

  const authorised = pool.filter((f) => f.sourceDocs.includes(docType));
  if (authorised.length === 1) return { key: authorised[0].key };
  if (authorised.length === 0) {
    // The value is real, the document just isn't an authorised source.
    return { key: null, reason: "doc_not_authorised" };
  }
  return disambiguate(authorised, docType, ctx?.snippet);
}

const INTERNSHIP_RE = /intern|clinical|posting|training|praktikum/i;
const SOCIAL_RE = /volunteer|voluntary|social|community|nss/i;

function disambiguate(
  candidates: FieldDef[],
  docType: string,
  snippet?: string,
): { key: string | null; reason?: UnmappedValue["reason"]; ambiguous?: FieldDef[] } {
  // 1. Document type decides.
  if (docType === "internship_cert") {
    const hit = candidates.find((c) => c.section === "internship");
    if (hit) return { key: hit.key };
  }
  if (docType === "social_cert") {
    const hit = candidates.find((c) => c.section === "social");
    if (hit) return { key: hit.key };
  }
  if (docType === "driving_licence") {
    const hit = candidates.find((c) => c.section === "driving");
    if (hit) return { key: hit.key };
  }
  if (docType !== "driving_licence") {
    const contact = candidates.find((c) => c.key === "contact.country");
    if (contact && candidates.some((c) => c.key === "driving.country")) return { key: contact.key };
  }

  // 2. CV / multi-section: nearest heading context in the OCR snippet.
  if (snippet) {
    if (INTERNSHIP_RE.test(snippet)) {
      const hit = candidates.find((c) => c.section === "internship");
      if (hit) return { key: hit.key };
    }
    if (SOCIAL_RE.test(snippet)) {
      const hit = candidates.find((c) => c.section === "social");
      if (hit) return { key: hit.key };
    }
  }

  // 3. Still ambiguous → the human decides. Write to neither.
  return { key: null, reason: "ambiguous", ambiguous: candidates };
}

export function statusFor(confidence: number, flags: string[]): FieldStatus {
  if (flags.some((f) => f !== "no_country_code")) return "needs_review";
  if (confidence >= 0.9) return "ai_high";
  if (confidence >= 0.7) return "ai_medium";
  return "ai_low";
}

/** Map one document's extraction output into canonical values. */
export function mapDocument(input: MapDocumentInput): MapDocumentResult {
  const docType = canonicalDocType(input.docType);
  const mapped: MappedValue[] = [];
  const unmapped: UnmappedValue[] = [];
  const reviewItems: MapDocumentResult["reviewItems"] = [];
  const trace: MapDocumentResult["trace"] = [];

  // ── MRZ first, always (highest reliability on a passport) ──
  let mrzPassportNo: string | undefined;
  let mrzPresent = false;
  let mrzChecksumValid = false;
  if (docType === "passport" && input.ocrText) {
    const mrz = parseMrz(input.ocrText);
    if (mrz) {
      mrzPresent = true;
      mrzChecksumValid = mrz.checksumValid;
      for (const [key, mf] of Object.entries(mrz.fields)) {
        const def = FIELD_BY_KEY[key];
        if (!def || !mf) continue;
        const norm = applyNormaliser(def.normaliser, mf.value, { fieldKey: key });
        const confidence = Math.max(0, Math.min(1, mf.confidence + norm.confidenceDelta));
        const flags = [...mf.flags, ...norm.flags];
        if (key === "passport.passport_no") mrzPassportNo = norm.value;
        mapped.push({
          key,
          section: def.section,
          fieldKey: def.fieldKey,
          value: norm.value,
          rawValue: mf.value,
          confidence,
          status: statusFor(confidence, flags),
          flags: [...flags, "from_mrz"],
          note: norm.note,
          documentId: input.documentId,
          docType,
          source: "mrz",
          page: 1,
          snippet: mrz.line2,
        });
        trace.push({ extracted: `mrz:${key}`, resolved: key, outcome: "mrz", rawValue: mf.value, normalisedValue: norm.value });
      }
      if (!mrz.checksumValid) {
        reviewItems.push({
          code: "mrz_checksum_failed",
          message: "The passport MRZ checksum did not validate — verify the identity fields.",
        });
      }
    }
  }

  // ── Model fields ───────────────────────────────────────────
  for (const raw of input.fields) {
    const value = (raw.value ?? "").toString().trim();
    if (!value || value.toLowerCase() === "null" || value === "-" || /^n\/?a$/i.test(value)) {
      trace.push({ extracted: raw.name, resolved: null, outcome: "empty", rawValue: value });
      continue;
    }
    const res = resolveKey(raw.name, docType, {
      sectionHint: raw.section ?? null,
      snippet: raw.rawText,
    });
    if (!res.key) {
      unmapped.push({
        name: raw.name,
        value,
        confidence: raw.confidence ?? 0,
        documentId: input.documentId,
        docType,
        reason: res.reason ?? "no_alias",
      });
      trace.push({ extracted: raw.name, resolved: null, outcome: res.reason ?? "no_alias", rawValue: value });
      if (res.reason === "ambiguous" && res.ambiguous) {
        reviewItems.push({
          code: "ambiguous_section",
          message: `Found "${value}" — which section does it belong to?`,
          options: res.ambiguous.map((a) => a.key),
        });
      }
      continue;
    }

    const def = FIELD_BY_KEY[res.key];
    const norm = applyNormaliser(def.normaliser, value, { fieldKey: def.key, mrzPassportNo });
    const confidence = Math.max(0, Math.min(1, (raw.confidence ?? 0) + norm.confidenceDelta));
    mapped.push({
      key: def.key,
      section: def.section,
      fieldKey: def.fieldKey,
      value: norm.value,
      rawValue: value,
      confidence,
      status: statusFor(confidence, norm.flags),
      flags: norm.flags,
      note: norm.note,
      documentId: input.documentId,
      docType,
      source: "model",
      page: raw.page,
      bbox: raw.bbox ?? null,
      snippet: raw.rawText,
    });
    trace.push({
      extracted: raw.name,
      resolved: def.key,
      outcome: "mapped",
      rawValue: value,
      normalisedValue: norm.value,
    });
  }

  return { mapped, unmapped, reviewItems, mrzPresent, mrzChecksumValid, trace };
}
