// ─────────────────────────────────────────────────────────────
// CANONICAL FIELD DICTIONARY — single source of truth.
// Every field is addressed as `section.field_key` (R1). No field
// key may be hard-coded anywhere else in the intake module.
// ─────────────────────────────────────────────────────────────

export type FieldType = "text" | "textarea" | "date" | "email" | "select" | "country";

export type NormaliserName =
  | "date"
  | "name"
  | "gender"
  | "country"
  | "cefr"
  | "provider"
  | "passport_no"
  | "phone"
  | "email"
  | "year"
  | "yes_no"
  | "text";

export interface FieldDef {
  key: string; // namespaced: "personal.first_name"
  section: string;
  fieldKey: string; // local key within the section
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  aliases: string[];
  normaliser: NormaliserName;
  sourceDocs: string[]; // document types authorised to fill this field
}

const IDENTITY_DOCS = ["passport", "cv", "other"];
const EDU_DOCS = ["degree", "transcript", "nursing_registration", "cv", "other"];

function f(
  section: string,
  fieldKey: string,
  label: string,
  type: FieldType,
  required: boolean,
  aliases: string[],
  normaliser: NormaliserName,
  sourceDocs: string[],
  options?: string[],
): FieldDef {
  return {
    key: `${section}.${fieldKey}`,
    section,
    fieldKey,
    label,
    type,
    required,
    aliases,
    normaliser,
    sourceDocs,
    options,
  };
}

export const GENDER_OPTIONS = ["Female", "Male", "Other", "Prefer not to say"];
export const CEFR_OPTIONS = ["A1", "A2", "B1", "B2", "C1", "C2"];
export const PROVIDER_OPTIONS = ["Goethe", "TELC", "ÖSD", "TestDaF", "Other"];

export const FIELD_DICTIONARY: FieldDef[] = [
  // ── personal ───────────────────────────────────────────────
  f("personal", "first_name", "First name", "text", true,
    ["first_name", "firstname", "given_name", "given_names", "givennames", "forename", "vorname", "name_given", "mrz_given_names"],
    "name", IDENTITY_DOCS),
  f("personal", "last_name", "Last name", "text", true,
    ["last_name", "lastname", "surname", "family_name", "familyname", "nachname", "name_surname", "mrz_surname"],
    "name", IDENTITY_DOCS),
  f("personal", "dob", "Date of birth", "date", true,
    ["dob", "date_of_birth", "dateofbirth", "birth_date", "birthdate", "geburtsdatum", "mrz_date_of_birth"],
    "date", [...IDENTITY_DOCS, "driving_licence", "medical"]),
  f("personal", "gender", "Gender", "select", false,
    ["gender", "sex", "geschlecht", "mrz_sex"],
    "gender", [...IDENTITY_DOCS, "medical"], GENDER_OPTIONS),
  f("personal", "nationality", "Nationality", "text", true,
    ["nationality", "nationalities", "citizenship", "nation", "staatsangehörigkeit", "staatsangehorigkeit", "mrz_nationality"],
    "country", IDENTITY_DOCS),

  // ── passport ───────────────────────────────────────────────
  f("passport", "passport_no", "Passport number", "text", true,
    ["passport_no", "passport_number", "passportnumber", "document_number", "doc_no", "passnummer", "mrz_document_number"],
    "passport_no", ["passport", "cv", "other"]),
  f("passport", "issue_date", "Issue date", "date", false,
    ["issue_date", "date_of_issue", "issued_on", "ausstellungsdatum"],
    "date", ["passport"]),
  f("passport", "expiry_date", "Expiry date", "date", true,
    ["expiry_date", "date_of_expiry", "expiration_date", "valid_until", "gültig_bis", "gultig_bis", "mrz_date_of_expiry"],
    "date", ["passport"]),
  f("passport", "place_issue", "Place of issue", "text", false,
    ["place_issue", "place_of_issue", "issuing_authority", "issued_at", "ausstellungsort", "behörde", "behorde"],
    "text", ["passport"]),

  // ── contact ────────────────────────────────────────────────
  f("contact", "email", "Email", "email", true,
    ["email", "email_address", "e_mail", "mail"],
    "email", ["cv", "employment_letter", "other"]),
  f("contact", "phone", "Phone", "text", true,
    ["phone", "phone_number", "mobile", "contact_number", "telephone", "tel"],
    "phone", ["cv", "employment_letter", "other"]),
  f("contact", "country", "Country", "select", false,
    ["country", "country_of_residence", "residence_country"],
    "country", ["cv", "passport", "other"]),
  f("contact", "city", "City", "text", false,
    ["city", "town", "place_of_residence", "ort"],
    "text", ["cv", "other"]),
  f("contact", "address", "Address", "textarea", false,
    ["address", "street_address", "full_address", "residential_address", "anschrift"],
    "text", ["cv", "passport", "other"]),

  // ── education ──────────────────────────────────────────────
  f("education", "qualification", "Highest qualification", "text", true,
    ["qualification", "degree", "degree_name", "degree_title", "programme", "program", "course", "abschluss"],
    "text", EDU_DOCS),
  f("education", "institution", "Institution", "text", false,
    ["institution", "university", "college", "school", "awarding_body", "hochschule"],
    "text", EDU_DOCS),
  f("education", "year", "Year of completion", "text", false,
    ["year", "year_of_completion", "graduation_year", "completion_date", "date_awarded"],
    "year", EDU_DOCS),
  f("education", "gpa", "GPA / Grade", "text", false,
    ["gpa", "grade", "cgpa", "percentage", "marks", "note", "final_grade"],
    "text", EDU_DOCS),

  // ── language ───────────────────────────────────────────────
  f("language", "provider", "Provider", "select", false,
    ["provider", "institute", "issuing_institute", "exam_body", "issuer", "prüfungsinstitut", "prufungsinstitut"],
    "provider", ["language_cert", "cv"], PROVIDER_OPTIONS),
  f("language", "level", "Level", "select", true,
    ["level", "cefr", "cefr_level", "certificate_level", "language_level", "niveau", "ger_niveau"],
    "cefr", ["language_cert", "cv"], CEFR_OPTIONS),
  f("language", "exam_date", "Examination date", "date", false,
    ["exam_date", "examination_date", "date_of_examination", "test_date", "prüfungsdatum", "prufungsdatum"],
    "date", ["language_cert"]),
  f("language", "cert_date", "Certificate date", "date", false,
    ["cert_date", "certificate_date", "date_of_issue", "issued_on"],
    "date", ["language_cert"]),

  // ── employment ─────────────────────────────────────────────
  f("employment", "employer", "Most recent employer", "text", false,
    ["employer", "company", "organisation", "organization", "hospital", "institution", "arbeitgeber"],
    "text", ["employment_letter", "cv"]),
  f("employment", "role", "Role / title", "text", false,
    ["role", "title", "job_title", "designation", "position", "most_recent_role", "tätigkeit", "tatigkeit"],
    "text", ["employment_letter", "cv"]),
  f("employment", "from", "From", "date", false,
    ["from", "start_date", "date_from", "employed_from", "von"],
    "date", ["employment_letter", "cv"]),
  f("employment", "to", "To", "date", false,
    ["to", "end_date", "date_to", "employed_until", "bis"],
    "date", ["employment_letter", "cv"]),

  // ── internship ─────────────────────────────────────────────
  f("internship", "org", "Organisation", "text", false,
    ["org", "organisation", "organization", "hospital", "institution", "placement"],
    "text", ["internship_cert", "cv"]),
  f("internship", "duration", "Duration", "text", false,
    ["duration", "period", "length", "months", "dauer"],
    "text", ["internship_cert", "cv"]),

  // ── social ─────────────────────────────────────────────────
  f("social", "org", "Organisation", "text", false,
    ["org", "organisation", "organization", "ngo", "society", "voluntary_body"],
    "text", ["social_cert", "cv"]),
  f("social", "duration", "Duration", "text", false,
    ["duration", "period", "length", "months"],
    "text", ["social_cert", "cv"]),

  // ── medical ────────────────────────────────────────────────
  f("medical", "fitness", "Fitness certificate on file", "select", false,
    ["fitness", "fitness_certificate", "medical_fitness", "fit_to_work"],
    "yes_no", ["medical"], ["Yes", "No"]),
  f("medical", "vaccinations", "Vaccinations recorded", "select", false,
    ["vaccinations", "immunisation", "immunization", "vaccination_status", "impfungen"],
    "text", ["medical"], ["Yes", "Partial", "No"]),
  f("medical", "notes", "Notes", "textarea", false,
    ["notes", "remarks", "observations", "bemerkungen"],
    "text", ["medical"]),

  // ── driving ────────────────────────────────────────────────
  f("driving", "licence_no", "Licence number", "text", false,
    ["licence_no", "license_no", "license_number", "dl_number", "driving_licence_number", "führerscheinnummer", "fuhrerscheinnummer"],
    "text", ["driving_licence"]),
  f("driving", "country", "Issuing country", "select", false,
    ["country", "issuing_country", "country_of_issue"],
    "country", ["driving_licence"]),
  f("driving", "category", "Category", "text", false,
    ["category", "class", "vehicle_class", "klasse"],
    "text", ["driving_licence"]),
  f("driving", "expiry", "Expiry", "date", false,
    ["expiry", "valid_until", "expiry_date", "date_of_expiry"],
    "date", ["driving_licence"]),
];

export const FIELD_BY_KEY: Record<string, FieldDef> = Object.fromEntries(
  FIELD_DICTIONARY.map((d) => [d.key, d]),
);

export const SECTION_ORDER = [
  "personal", "passport", "contact", "education", "language",
  "employment", "internship", "social", "medical", "driving",
] as const;

export function fieldsForSection(section: string): FieldDef[] {
  return FIELD_DICTIONARY.filter((d) => d.section === section);
}

export function requiredFields(): FieldDef[] {
  return FIELD_DICTIONARY.filter((d) => d.required);
}

/** Namespaced key → {section, field} for legacy consumers. */
export function splitKey(key: string): { section: string; field: string } {
  const i = key.indexOf(".");
  return i < 0 ? { section: "", field: key } : { section: key.slice(0, i), field: key.slice(i + 1) };
}
