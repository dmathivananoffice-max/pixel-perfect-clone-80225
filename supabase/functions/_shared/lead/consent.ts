import type { ConsentInput, StoredConsent } from "./types.ts";

export type ConsentResult =
  | { ok: true; consent: StoredConsent }
  | { ok: false; error: string };

/** Validate granular consent; booleans must be present (no defaults) — FR-L-03. */
export function validateConsent(
  input: unknown,
  now: Date = new Date(),
): ConsentResult {
  if (input == null || typeof input !== "object") {
    return { ok: false, error: "consent is required" };
  }
  const c = input as Record<string, unknown>;

  for (const key of ["whatsapp", "email", "assessment_processing"] as const) {
    if (typeof c[key] !== "boolean") {
      return {
        ok: false,
        error: `consent.${key} must be an explicit boolean`,
      };
    }
  }

  if (
    typeof c.consent_text_version !== "string" ||
    !c.consent_text_version.trim()
  ) {
    return { ok: false, error: "consent.consent_text_version is required" };
  }

  // At least one processing basis or channel for capture to be meaningful
  if (
    !c.whatsapp &&
    !c.email &&
    !c.assessment_processing
  ) {
    return {
      ok: false,
      error: "at least one consent flag must be true",
    };
  }

  const consent: StoredConsent = {
    whatsapp: c.whatsapp as boolean,
    email: c.email as boolean,
    assessment_processing: c.assessment_processing as boolean,
    consent_text_version: (c.consent_text_version as string).trim(),
    timestamp: now.toISOString(),
  };

  return { ok: true, consent };
}

export function isConsentInput(value: unknown): value is ConsentInput {
  return validateConsent(value).ok;
}
