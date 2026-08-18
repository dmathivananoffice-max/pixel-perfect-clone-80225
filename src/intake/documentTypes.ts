// ─────────────────────────────────────────────────────────────
// DOCUMENT TYPE REGISTRY — the one place document type strings live.
// Classifier, upload checklist, document rail and mapper all read this.
// ─────────────────────────────────────────────────────────────

export interface DocTypeDef {
  id: string;
  label: string;
  /** Regexes matched against OCR text + filename + folder name. */
  signals: RegExp[];
  /** Namespaced field prefixes this document may fill. */
  fills: string[];
  /** Higher = more authoritative for the fields it fills. */
  authority: number;
}

export const DOCUMENT_TYPES: DocTypeDef[] = [
  { id: "passport", label: "Passport", authority: 100, fills: ["personal.", "passport."],
    signals: [/\bP</, /passport/i, /reisepass/i, /passeport/i, /\bpass\b/i] },
  { id: "photo", label: "Passport photo", authority: 0, fills: [],
    signals: [/\bphoto\b/i, /lichtbild/i, /\bfoto\b/i] },
  { id: "degree", label: "Degree certificate", authority: 80, fills: ["education."],
    signals: [/\bdegree\b/i, /bachelor/i, /master of/i, /diploma/i, /conferred/i, /zeugnis/i, /abschluss/i] },
  { id: "transcript", label: "Academic transcript", authority: 60, fills: ["education."],
    signals: [/transcript/i, /\bmarks\b/i, /grade sheet/i, /semester/i] },
  { id: "language_cert", label: "Language certificate", authority: 90, fills: ["language."],
    signals: [/goethe/i, /\btelc\b/i, /ösd|oesd/i, /testdaf/i, /\b[ABC][12]\b/, /sprach/i, /zertifikat deutsch/i] },
  { id: "police", label: "Police clearance", authority: 10, fills: [],
    signals: [/police clearance/i, /\bpcc\b/i, /führungszeugnis|fuehrungszeugnis/i, /no criminal record/i, /\bpcr\b/i] },
  { id: "employment_letter", label: "Employment / experience letter", authority: 85, fills: ["employment."],
    signals: [/to whom it may concern/i, /experience certificate/i, /relieving/i, /employment letter/i, /arbeitszeugnis/i] },
  { id: "internship_cert", label: "Internship certificate", authority: 85, fills: ["internship."],
    signals: [/internship/i, /clinical posting/i, /training completed/i, /praktikum/i] },
  { id: "social_cert", label: "Social work certificate", authority: 85, fills: ["social."],
    signals: [/voluntary/i, /social service/i, /\bnss\b/i, /community service/i] },
  { id: "medical", label: "Medical / fitness certificate", authority: 85, fills: ["medical."],
    signals: [/medically fit/i, /fitness certificate/i, /vaccination/i, /immunisation|immunization/i, /gesundheit/i] },
  { id: "driving_licence", label: "Driving licence", authority: 85, fills: ["driving."],
    signals: [/driving licence|driving license/i, /führerschein|fuehrerschein/i, /\bdl no\b/i] },
  { id: "nursing_registration", label: "Nursing council registration", authority: 55, fills: ["education.institution"],
    signals: [/nursing council/i, /registration number/i, /\brn\/rm\b/i] },
  { id: "cv", label: "CV / résumé", authority: 20, fills: [""],
    signals: [/curriculum vitae/i, /\bresume\b/i, /lebenslauf/i, /\bcv\b/i] },
  { id: "other", label: "Unclassified", authority: 5, fills: [] },
].map((d) => ({ ...d, signals: (d as DocTypeDef).signals ?? [] })) as DocTypeDef[];

export const DOC_TYPE_IDS = DOCUMENT_TYPES.map((d) => d.id);

export function docTypeDef(id: string | null | undefined): DocTypeDef {
  return DOCUMENT_TYPES.find((d) => d.id === id) ?? DOCUMENT_TYPES[DOCUMENT_TYPES.length - 1];
}

export function docAuthority(id: string | null | undefined): number {
  return docTypeDef(id).authority;
}

/** Legacy type strings used elsewhere in the app → registry ids. */
const LEGACY_TYPE_MAP: Record<string, string> = {
  sprach: "language_cert",
  language: "language_cert",
  driving: "driving_licence",
  employment: "employment_letter",
  internship: "internship_cert",
  social: "social_cert",
  pcr: "police",
  passport_bio: "passport",
  reisepass: "passport",
  qualification: "degree",
};

export function canonicalDocType(raw: string | null | undefined): string {
  const t = (raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!t) return "other";
  if (DOC_TYPE_IDS.includes(t)) return t;
  return LEGACY_TYPE_MAP[t] ?? "other";
}

export interface Classification {
  type: string;
  confidence: number;
  evidence: string[];
}

/**
 * Classify from OCR text + filename + folder name. Filename alone is enough
 * for obvious cases ("ANNA Reisepass.pdf" → passport).
 */
export function classifyDocument(input: {
  fileName?: string;
  folderName?: string;
  ocrText?: string;
}): Classification {
  const name = `${input.folderName ?? ""} ${input.fileName ?? ""}`;
  const text = input.ocrText ?? "";
  let best: Classification = { type: "other", confidence: 0, evidence: [] };

  for (const def of DOCUMENT_TYPES) {
    if (def.id === "other") continue;
    const evidence: string[] = [];
    let score = 0;
    for (const re of def.signals) {
      const inName = name.match(re);
      if (inName) {
        score += 0.6;
        evidence.push(inName[0]);
      }
      const inText = text.match(re);
      if (inText) {
        score += 0.45;
        evidence.push(inText[0]);
      }
    }
    if (score === 0) continue;
    const confidence = Math.min(0.99, score);
    if (confidence > best.confidence) best = { type: def.id, confidence, evidence };
  }

  // A single strong filename signal (0.6) is enough — anything weaker is "other".
  if (best.confidence < 0.6) {
    return { type: "other", confidence: best.confidence, evidence: best.evidence };
  }
  return best;
}
