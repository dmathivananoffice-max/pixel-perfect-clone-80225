// ─────────────────────────────────────────────────────────────
// MULTI-DOCUMENT MERGE — deterministic precedence + conflicts.
//   1 human-edited · 2 valid MRZ · 3 document authority
//   4 confidence · 5 recency
// ─────────────────────────────────────────────────────────────
import { docAuthority } from "./documentTypes";
import { FIELD_BY_KEY, requiredFields } from "./fieldDictionary";
import type { FieldStatus, MappedValue } from "./mapper";

export interface CompetingValue {
  value: string;
  confidence: number;
  documentId: string;
  docType: string;
}

export interface MergedField {
  key: string;
  section: string;
  fieldKey: string;
  value: string;
  rawValue: string;
  confidence: number;
  status: FieldStatus;
  flags: string[];
  note?: string;
  documentId: string;
  docType: string;
  source: "mrz" | "model" | "human";
  page?: number;
  bbox?: { x: number; y: number; w: number; h: number } | null;
  snippet?: string;
  competing: CompetingValue[];
}

export interface HumanValue {
  key: string;
  value: string;
  status: "human_edited" | "verified";
}

const CONFLICT_FLOOR = 0.7;

function score(v: MappedValue): number {
  const mrzBonus = v.source === "mrz" && !v.flags.includes("mrz_checksum_failed") ? 1000 : 0;
  return mrzBonus + docAuthority(v.docType) * 10 + v.confidence * 10;
}

/** Merge all mapped values for ONE candidate into one value per canonical key. */
export function mergeCandidateFields(
  values: MappedValue[],
  humanValues: HumanValue[] = [],
): MergedField[] {
  const byKey = new Map<string, MappedValue[]>();
  for (const v of values) {
    const arr = byKey.get(v.key) ?? [];
    arr.push(v);
    byKey.set(v.key, arr);
  }

  const humanByKey = new Map(humanValues.map((h) => [h.key, h]));
  const out: MergedField[] = [];

  for (const [key, list] of byKey) {
    const ranked = [...list]
      .map((v) => ({ ...v, value: (v.value ?? "").toString(), rawValue: (v.rawValue ?? "").toString() }))
      .sort((a, b) => score(b) - score(a));
    const winner = ranked[0];
    if (!winner) continue;
    const competing: CompetingValue[] = ranked.slice(1).map((v) => ({
      value: v.value,
      confidence: v.confidence,
      documentId: v.documentId,
      docType: v.docType,
    }));

    const disagreeing = ranked.filter(
      (v) =>
        v.value.toLowerCase() !== winner.value.toLowerCase() &&
        v.confidence >= CONFLICT_FLOOR &&
        winner.confidence >= CONFLICT_FLOOR,
    );

    const human = humanByKey.get(key);
    if (human) {
      // R4 — a human edit outranks every AI value, permanently.
      out.push({
        ...winner,
        value: human.value,
        rawValue: winner.rawValue,
        status: human.status,
        source: "human",
        confidence: 1,
        competing,
      });
      humanByKey.delete(key);
      continue;
    }

    out.push({
      ...winner,
      status: disagreeing.length > 0 ? "conflict" : winner.status,
      flags: disagreeing.length > 0 ? [...winner.flags, "cross_document_conflict"] : winner.flags,
      competing,
    });
  }

  // Human values with no AI counterpart still belong in the record.
  for (const [key, h] of humanByKey) {
    const def = FIELD_BY_KEY[key];
    if (!def) continue;
    out.push({
      key,
      section: def.section,
      fieldKey: def.fieldKey,
      value: h.value,
      rawValue: h.value,
      confidence: 1,
      status: h.status,
      flags: [],
      documentId: "",
      docType: "",
      source: "human",
      competing: [],
    });
  }

  return out;
}

// ── Cross-field validation — produces review items, never rejections ──

export interface ReviewItem {
  key?: string;
  code: string;
  message: string;
  severity: "warning" | "review";
}

export function validateMerged(fields: MergedField[]): ReviewItem[] {
  const get = (k: string) => fields.find((f) => f.key === k)?.value ?? "";
  const items: ReviewItem[] = [];
  const d = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s) : null);

  const exp = d(get("passport.expiry_date"));
  const iss = d(get("passport.issue_date"));
  const dob = d(get("personal.dob"));
  const now = new Date();

  if (exp && exp <= now)
    items.push({ key: "passport.expiry_date", code: "passport_expired", message: "Passport has expired.", severity: "review" });
  else if (exp) {
    const months = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.4);
    if (months < 6)
      items.push({
        key: "passport.expiry_date",
        code: "passport_expiring",
        message: `Passport expires in ${Math.max(0, Math.round(months))} months — may be insufficient for visa processing.`,
        severity: "warning",
      });
  }
  if (iss && exp && iss >= exp)
    items.push({ key: "passport.issue_date", code: "issue_after_expiry", message: "Passport issue date is after its expiry date.", severity: "review" });
  if (dob && iss && iss <= dob)
    items.push({ key: "passport.issue_date", code: "issue_before_dob", message: "Passport issue date precedes the date of birth.", severity: "review" });
  if (dob) {
    const age = (now.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (age < 17 || age > 65)
      items.push({ key: "personal.dob", code: "age_out_of_range", message: `Derived age ${Math.round(age)} is outside 17–65.`, severity: "review" });
  }
  const from = d(get("employment.from"));
  const to = d(get("employment.to"));
  if (from && to && from > to)
    items.push({ key: "employment.to", code: "employment_range", message: "Employment start date is after the end date.", severity: "review" });
  const examD = d(get("language.exam_date"));
  const certD = d(get("language.cert_date"));
  if (examD && certD && examD > certD)
    items.push({ key: "language.cert_date", code: "language_dates", message: "Examination date is after the certificate date.", severity: "review" });

  for (const f of fields) {
    if (f.status === "conflict") {
      const others = f.competing.map((c) => `${c.docType} says ${c.value}`).join(" · ");
      items.push({ key: f.key, code: "conflict", message: `${f.docType} says ${f.value} · ${others}`, severity: "review" });
    }
    if (f.flags.includes("ambiguous_date"))
      items.push({ key: f.key, code: "ambiguous_date", message: f.note ?? "Ambiguous date format — confirm the correct reading.", severity: "review" });
  }

  return items;
}

/**
 * ONE definition of readiness, shared by Mission Control's extraction
 * success % and the per-candidate readiness ring (Part 7.4).
 */
export function readiness(fields: MergedField[]): {
  requiredTotal: number;
  requiredSatisfied: number;
  pct: number;
  lowConfidence: number;
  conflicts: number;
  missingRequired: string[];
} {
  const req = requiredFields();
  const byKey = new Map(fields.map((f) => [f.key, f]));
  let satisfied = 0;
  let lowConfidence = 0;
  const missingRequired: string[] = [];
  for (const def of req) {
    const f = byKey.get(def.key);
    const good =
      !!f &&
      !!f.value &&
      (f.status === "verified" || f.status === "human_edited" || f.status === "ai_high");
    if (good) satisfied += 1;
    if (!f || !f.value) missingRequired.push(def.key);
    if (f && f.value && f.confidence < 0.7) lowConfidence += 1;
  }
  const conflicts = fields.filter((f) => f.status === "conflict").length;
  return {
    requiredTotal: req.length,
    requiredSatisfied: satisfied,
    pct: req.length === 0 ? 0 : Math.round((satisfied / req.length) * 100),
    lowConfidence,
    conflicts,
    missingRequired,
  };
}
