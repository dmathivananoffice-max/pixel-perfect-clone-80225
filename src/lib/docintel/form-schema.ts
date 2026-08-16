/**
 * Canonical Verification Studio form schema.
 *
 * OCR extraction MUST use these exact section + field keys so values
 * prefill the Candidate Intake forms. Synonyms are rejected by the
 * Together parser and remapped here only as a legacy/safety net.
 */

export const ALLOWED_SECTIONS = [
  "personal",
  "passport",
  "contact",
  "education",
  "language",
  "employment",
  "internship",
  "social",
  "medical",
  "driving",
] as const;

export type FormSectionId = (typeof ALLOWED_SECTIONS)[number];

export const ALLOWED_FIELDS: Record<FormSectionId, readonly string[]> = {
  personal: ["first_name", "last_name", "dob", "gender", "nationality"],
  passport: ["passport_no", "issue_date", "expiry_date", "place_issue"],
  contact: ["email", "phone", "country", "city", "address"],
  education: ["qualification", "institution", "year", "gpa"],
  language: ["provider", "level", "exam_date", "cert_date"],
  employment: ["employer", "role", "from", "to"],
  internship: ["org", "duration"],
  social: ["org", "duration"],
  medical: ["fitness", "vaccinations", "notes"],
  driving: ["licence_no", "country", "category", "expiry"],
};

export const ALLOWED_DOCUMENT_TYPES = [
  "passport",
  "photo",
  "degree",
  "sprach",
  "cv",
  "police",
  "medical",
  "driving",
  "employment",
  "internship",
  "social",
  "other",
] as const;

export type AllowedDocumentType = (typeof ALLOWED_DOCUMENT_TYPES)[number];

/** Legacy OCR keys → form (section, field). Used as a safety net only. */
export const LEGACY_FIELD_ALIASES: Record<string, { section: FormSectionId; field: string }> = {
  // section was historically "identity"
  passport_number: { section: "passport", field: "passport_no" },
  passport_expiry: { section: "passport", field: "expiry_date" },
  date_of_birth: { section: "personal", field: "dob" },
  given_name: { section: "personal", field: "first_name" },
  given_names: { section: "personal", field: "first_name" },
  surname: { section: "personal", field: "last_name" },
  family_name: { section: "personal", field: "last_name" },
  full_name: { section: "personal", field: "first_name" }, // last resort — only fills first_name
  degree_title: { section: "education", field: "qualification" },
  graduation_year: { section: "education", field: "year" },
  certificate_level: { section: "language", field: "level" },
  issuing_institute: { section: "language", field: "provider" },
  examination_date: { section: "language", field: "exam_date" },
  issued_on: { section: "language", field: "cert_date" },
  most_recent_role: { section: "employment", field: "role" },
};

const SECTION_SET = new Set<string>(ALLOWED_SECTIONS);

export function isAllowedSection(section: string): section is FormSectionId {
  return SECTION_SET.has(section);
}

export function isAllowedField(section: string, field: string): boolean {
  if (!isAllowedSection(section)) return false;
  return (ALLOWED_FIELDS[section] as readonly string[]).includes(field);
}

export interface NormalizedExtraction {
  section: FormSectionId;
  field_name: string;
  value: string;
  confidence: number;
  evidence?: string;
  bounding_box?: [number, number, number, number] | null;
  page_number?: number;
}

/**
 * Normalize one raw model field into a form-compatible extraction.
 * Returns null when the field is empty, null, or cannot be mapped.
 */
export function normalizeExtractionField(raw: {
  section?: unknown;
  field_name?: unknown;
  value?: unknown;
  confidence?: unknown;
  evidence?: unknown;
  bounding_box?: unknown;
  page_number?: unknown;
}): NormalizedExtraction | null {
  const rawSection = String(raw.section ?? "").trim();
  const rawField = String(raw.field_name ?? "").trim();
  if (!rawField) return null;

  // Treat JSON null / "null" / blank as missing.
  if (raw.value == null) return null;
  const value = String(raw.value).trim();
  if (!value || value.toLowerCase() === "null") return null;

  let section = rawSection;
  let field = rawField;

  // Prefer exact form keys; otherwise remap known legacy synonyms.
  if (!isAllowedField(section, field)) {
    const alias = LEGACY_FIELD_ALIASES[field];
    if (alias) {
      section = alias.section;
      field = alias.field;
    } else if (section === "identity" && isAllowedField("personal", field)) {
      section = "personal";
    } else if (section === "identity" && isAllowedField("passport", field)) {
      section = "passport";
    } else if (section === "address" && isAllowedField("contact", field)) {
      section = "contact";
    } else if (section === "general" && LEGACY_FIELD_ALIASES[field]) {
      section = LEGACY_FIELD_ALIASES[field].section;
      field = LEGACY_FIELD_ALIASES[field].field;
    } else {
      return null;
    }
  }

  if (!isAllowedField(section, field)) return null;

  // Medical enum soft-normalize.
  if (section === "medical" && field === "fitness") {
    const v = value.toLowerCase();
    if (v === "yes") return finish("medical", "fitness", "Yes", raw);
    if (v === "no") return finish("medical", "fitness", "No", raw);
    return null;
  }
  if (section === "medical" && field === "vaccinations") {
    const v = value.toLowerCase();
    if (v === "yes") return finish("medical", "vaccinations", "Yes", raw);
    if (v === "partial") return finish("medical", "vaccinations", "Partial", raw);
    if (v === "no") return finish("medical", "vaccinations", "No", raw);
    return null;
  }

  return finish(section as FormSectionId, field, value, raw);
}

function finish(
  section: FormSectionId,
  field_name: string,
  value: string,
  raw: {
    confidence?: unknown;
    evidence?: unknown;
    bounding_box?: unknown;
    page_number?: unknown;
  },
): NormalizedExtraction {
  const confidence = Math.max(0, Math.min(1, Number(raw.confidence ?? 0)));
  const bbox =
    Array.isArray(raw.bounding_box) && raw.bounding_box.length === 4
      ? ([
          Number(raw.bounding_box[0]),
          Number(raw.bounding_box[1]),
          Number(raw.bounding_box[2]),
          Number(raw.bounding_box[3]),
        ] as [number, number, number, number])
      : null;
  return {
    section,
    field_name,
    value,
    confidence,
    evidence: typeof raw.evidence === "string" ? raw.evidence : undefined,
    bounding_box: bbox,
    page_number: typeof raw.page_number === "number" ? raw.page_number : undefined,
  };
}

/**
 * Remap a nested extraction map (section → field → value) so that
 * legacy keys land in the Verification Studio form slots.
 */
export function remapExtractionMap<T extends { value: string; confidence: number }>(
  map: Record<string, Record<string, T>>,
): Record<string, Record<string, T>> {
  const out: Record<string, Record<string, T>> = {};
  for (const [sec, fields] of Object.entries(map)) {
    for (const [key, entry] of Object.entries(fields)) {
      const normalized = normalizeExtractionField({
        section: sec,
        field_name: key,
        value: entry.value,
        confidence: entry.confidence,
      });
      if (!normalized) continue;
      out[normalized.section] = out[normalized.section] ?? {};
      // Prefer higher confidence when both legacy + new keys exist.
      const prev = out[normalized.section][normalized.field_name];
      if (!prev || (entry.confidence ?? 0) >= (prev.confidence ?? 0)) {
        out[normalized.section][normalized.field_name] = {
          ...entry,
          value: normalized.value,
          confidence: normalized.confidence,
        };
      }
    }
  }
  return out;
}
