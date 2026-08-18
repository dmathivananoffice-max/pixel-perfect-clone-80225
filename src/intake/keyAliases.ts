// ─────────────────────────────────────────────────────────────
// Addendum B § M4 — legacy key aliases.
//
// Reads of a legacy `section.field` key resolve through LEGACY_KEY_MAP to
// the new table/column/ordinal. Writes go to that new address only.
// `language.exam_date` is read-only because it fans out onto
// intake_language_modules rows.
//
// Every resolveLegacyKey() call increments aliasResolutionCount, which the
// admin Parity screen exposes.
// ─────────────────────────────────────────────────────────────

export type LegacyAliasTable =
  | "intake_education_records"
  | "intake_language_certificates"
  | "intake_language_modules";

export interface LegacyAliasTarget {
  table: LegacyAliasTable;
  column: string;
  ordinal: 0;
  writable: boolean;
}

export const LEGACY_KEY_MAP: Readonly<Record<string, LegacyAliasTarget>> = {
  "education.qualification": {
    table: "intake_education_records",
    column: "qualification",
    ordinal: 0,
    writable: true,
  },
  "education.institution": {
    table: "intake_education_records",
    column: "institution",
    ordinal: 0,
    writable: true,
  },
  "education.year": {
    table: "intake_education_records",
    column: "year",
    ordinal: 0,
    writable: true,
  },
  "education.gpa": {
    table: "intake_education_records",
    column: "gpa",
    ordinal: 0,
    writable: true,
  },
  "language.provider": {
    table: "intake_language_certificates",
    column: "provider",
    ordinal: 0,
    writable: true,
  },
  "language.level": {
    table: "intake_language_certificates",
    column: "level",
    ordinal: 0,
    writable: true,
  },
  "language.cert_date": {
    table: "intake_language_certificates",
    column: "cert_date",
    ordinal: 0,
    writable: true,
  },
  // Fan-out onto listening/reading/writing/speaking modules. Reads resolve;
  // writes through this key are refused.
  "language.exam_date": {
    table: "intake_language_modules",
    column: "exam_date",
    ordinal: 0,
    writable: false,
  },
};

let aliasResolutionCount = 0;

export function getAliasResolutionCount(): number {
  return aliasResolutionCount;
}

export function resetAliasResolutionCount(): void {
  aliasResolutionCount = 0;
}

/** Resolve a legacy namespaced key. Increments the counter on every call. */
export function resolveLegacyKey(key: string): LegacyAliasTarget | null {
  aliasResolutionCount += 1;
  return LEGACY_KEY_MAP[key] ?? null;
}

export class ReadOnlyAliasError extends Error {
  readonly key: string;
  constructor(key: string) {
    super(`${key} is read-only through the alias layer (fan-out)`);
    this.name = "ReadOnlyAliasError";
    this.key = key;
  }
}

/**
 * Write target for a legacy key. Resolves through LEGACY_KEY_MAP (and
 * increments the counter). Returns null for unmapped keys. Throws for
 * language.exam_date — callers must write module rows instead.
 */
export function writeTargetForLegacyKey(key: string): LegacyAliasTarget | null {
  const target = resolveLegacyKey(key);
  if (!target) return null;
  if (!target.writable) throw new ReadOnlyAliasError(key);
  return target;
}

export const EDUCATION_LEGACY_KEYS = [
  "education.qualification",
  "education.institution",
  "education.year",
  "education.gpa",
] as const;

export const LANGUAGE_LEGACY_KEYS = [
  "language.provider",
  "language.level",
  "language.exam_date",
  "language.cert_date",
] as const;

export const WRITABLE_LEGACY_KEYS = [
  ...EDUCATION_LEGACY_KEYS,
  "language.provider",
  "language.level",
  "language.cert_date",
] as const;

/** Backfill literals from M2.2 / M3.2 — do not classify or infer. */
export const BACKFILL_EDUCATION_LEVEL = "unknown" as const;
export const BACKFILL_GRADE_SCALE = "other" as const;
export const BACKFILL_OVERALL_RESULT = "unknown" as const;

const HUMAN_STATUS_RANK: Record<string, number> = {
  verified: 100,
  human_edited: 90,
};

/** Strongest human status on any legacy field becomes the record status. */
export function strongestHumanStatus(statuses: Array<string | null | undefined>): string {
  let best: string | null = null;
  let bestRank = 0;
  for (const raw of statuses) {
    if (!raw) continue;
    const rank = HUMAN_STATUS_RANK[raw] ?? 0;
    if (rank > bestRank) {
      bestRank = rank;
      best = raw;
    }
  }
  return best ?? "pending";
}

export function hasLegacyEducationData(values: Record<string, string | null | undefined>): boolean {
  return EDUCATION_LEGACY_KEYS.some((key) => {
    const local = key.split(".")[1];
    return Boolean((values[local] ?? "").toString().trim());
  });
}

export function hasLegacyLanguageData(values: Record<string, string | null | undefined>): boolean {
  return LANGUAGE_LEGACY_KEYS.some((key) => {
    const local = key.split(".")[1];
    return Boolean((values[local] ?? "").toString().trim());
  });
}

export interface ProjectedEducationWrite {
  table: "intake_education_records";
  ordinal: 0;
  qualification: string | null;
  institution: string | null;
  year: string | null;
  gpa: string | null;
}

export interface ProjectedLanguageWrite {
  table: "intake_language_certificates";
  ordinal: 0;
  provider: string | null;
  level: string | null;
  cert_date: string | null;
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").toString().trim();
  return trimmed ? trimmed : null;
}

/**
 * Project a nested extracted_fields bag onto new-address writes.
 * language.exam_date is omitted (read-only / fan-out).
 */
export function projectWritesToNewAddresses(
  values: Record<string, Record<string, string>> | null | undefined,
): { education: ProjectedEducationWrite | null; language: ProjectedLanguageWrite | null } {
  const educationBag = values?.education ?? {};
  const languageBag = values?.language ?? {};

  const education: ProjectedEducationWrite | null = hasLegacyEducationData(educationBag)
    ? {
        table: "intake_education_records",
        ordinal: 0,
        qualification: emptyToNull(educationBag.qualification),
        institution: emptyToNull(educationBag.institution),
        year: emptyToNull(educationBag.year),
        gpa: emptyToNull(educationBag.gpa),
      }
    : null;

  const language: ProjectedLanguageWrite | null = hasLegacyLanguageData({
    provider: languageBag.provider,
    level: languageBag.level,
    cert_date: languageBag.cert_date,
    exam_date: languageBag.exam_date,
  })
    ? {
        table: "intake_language_certificates",
        ordinal: 0,
        provider: emptyToNull(languageBag.provider),
        level: emptyToNull(languageBag.level),
        cert_date: emptyToNull(languageBag.cert_date),
      }
    : null;

  return { education, language };
}

/** Read a legacy key from a new-address row, incrementing the resolution counter. */
export function readFromNewAddress(
  key: string,
  row: Record<string, unknown> | null | undefined,
): string {
  const target = resolveLegacyKey(key);
  if (!target) return "";
  const raw = row?.[target.column];
  return raw == null ? "" : String(raw);
}
