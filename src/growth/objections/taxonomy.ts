import type { ObjectionCode, TaxonomyMapping } from "./types";

export const TAXONOMY_CODES: ObjectionCode[] = [
  "COST",
  "TRUST/FRAUD-FEAR",
  "VISA-RISK",
  "LANGUAGE-DIFFICULTY",
  "PARENT-APPROVAL",
  "RECOGNITION-RISK",
  "TIMELINE",
  "COMPETITOR-COMPARISON",
  "SAFETY-ABROAD",
  "SELF-DOUBT",
  "UNCLASSIFIED",
];

/** Short labels for one-tap UI (<10s counsellor logging). */
export const TAXONOMY_TAP_LABELS: Record<ObjectionCode, string> = {
  COST: "Cost",
  "TRUST/FRAUD-FEAR": "Trust",
  "VISA-RISK": "Visa",
  "LANGUAGE-DIFFICULTY": "Language",
  "PARENT-APPROVAL": "Parents",
  "RECOGNITION-RISK": "Recognition",
  TIMELINE: "Timeline",
  "COMPETITOR-COMPARISON": "Competitor",
  "SAFETY-ABROAD": "Safety",
  "SELF-DOUBT": "Self-doubt",
  UNCLASSIFIED: "Other",
};

/** Exit-survey tap / reply number → taxonomy code */
export const EXIT_SURVEY_CHOICES: { n: number; code: ObjectionCode; label: string }[] =
  [
    { n: 1, code: "COST", label: "Cost / fees" },
    { n: 2, code: "TRUST/FRAUD-FEAR", label: "Trust / not sure it's real" },
    { n: 3, code: "VISA-RISK", label: "Visa worry" },
    { n: 4, code: "LANGUAGE-DIFFICULTY", label: "German language" },
    { n: 5, code: "PARENT-APPROVAL", label: "Family / parents" },
    { n: 6, code: "RECOGNITION-RISK", label: "Recognition of qualification" },
    { n: 7, code: "TIMELINE", label: "Takes too long" },
    { n: 8, code: "COMPETITOR-COMPARISON", label: "Looking at another option" },
    { n: 9, code: "SAFETY-ABROAD", label: "Safety abroad" },
    { n: 10, code: "SELF-DOUBT", label: "Not sure I'm ready" },
  ];

export function parseExitSurveyReply(text: string): ObjectionCode | null {
  const trimmed = text.trim();
  const num = Number.parseInt(trimmed, 10);
  if (!Number.isNaN(num)) {
    return EXIT_SURVEY_CHOICES.find((c) => c.n === num)?.code ?? null;
  }
  const upper = trimmed.toUpperCase();
  if ((TAXONOMY_CODES as string[]).includes(upper)) {
    return upper as ObjectionCode;
  }
  const byLabel = EXIT_SURVEY_CHOICES.find(
    (c) => c.label.toLowerCase() === trimmed.toLowerCase(),
  );
  return byLabel?.code ?? null;
}

export function defaultMappings(): TaxonomyMapping[] {
  const now = new Date().toISOString();
  return TAXONOMY_CODES.map((code) => ({
    code,
    label: TAXONOMY_TAP_LABELS[code],
    underlying_fear: "",
    evidence_type: "",
    approved_asset_refs: [],
    talk_track: "",
    active: true,
    updated_by: "default",
    updated_at: now,
  }));
}
