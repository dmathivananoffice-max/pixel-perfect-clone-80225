// Writes of mapped education/language keys go to the new address only.
// extracted_fields remains populated by Phase 3 ordinal-0 sync triggers
// (and by the existing persist path so recruiter UI is unchanged).
import { supabase } from "@/integrations/supabase/client";
import {
  projectWritesToNewAddresses,
  writeTargetForLegacyKey,
  WRITABLE_LEGACY_KEYS,
} from "@/intake/keyAliases";

function isMissingRelation(err: { message?: string; code?: string } | null): boolean {
  const msg = (err?.message ?? "").toLowerCase();
  return (
    err?.code === "42P01" ||
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table")
  );
}

/**
 * Upsert ordinal-0 education/language rows for a candidate.
 * Safe to call before Phase 1 is applied (missing tables are skipped).
 * Does not write language.exam_date (read-only through the alias layer).
 */
export async function writeMappedFieldsToNewAddresses(
  candidateId: string,
  values: Record<string, Record<string, string>> | null | undefined,
): Promise<{ wrote: boolean; skipped: boolean; error?: string }> {
  const projected = projectWritesToNewAddresses(values);
  if (!projected.education && !projected.language) {
    return { wrote: false, skipped: false };
  }

  if (projected.education) {
    for (const key of WRITABLE_LEGACY_KEYS.filter((k) => k.startsWith("education."))) {
      writeTargetForLegacyKey(key);
    }
    const { error } = await supabase.from("intake_education_records").upsert(
      {
        candidate_id: candidateId,
        ordinal: 0,
        qualification: projected.education.qualification,
        institution: projected.education.institution,
        year: projected.education.year,
        gpa: projected.education.gpa,
      },
      { onConflict: "candidate_id,ordinal" },
    );
    if (error) {
      if (isMissingRelation(error)) return { wrote: false, skipped: true, error: error.message };
      return { wrote: false, skipped: false, error: error.message };
    }
  }

  if (projected.language) {
    for (const key of WRITABLE_LEGACY_KEYS.filter((k) => k.startsWith("language."))) {
      writeTargetForLegacyKey(key);
    }
    const { error } = await supabase.from("intake_language_certificates").upsert(
      {
        candidate_id: candidateId,
        ordinal: 0,
        provider: projected.language.provider,
        level: projected.language.level,
        cert_date: projected.language.cert_date,
      },
      { onConflict: "candidate_id,ordinal" },
    );
    if (error) {
      if (isMissingRelation(error)) return { wrote: false, skipped: true, error: error.message };
      return { wrote: false, skipped: false, error: error.message };
    }
  }

  return { wrote: true, skipped: false };
}

export async function syncMappedWritesToNewAddresses(
  candidateId: string,
  values: Record<string, Record<string, string>> | null | undefined,
): Promise<void> {
  try {
    const result = await writeMappedFieldsToNewAddresses(candidateId, values);
    if (result.error && !result.skipped) {
      console.warn("[intake] new-address write failed", result.error);
    }
  } catch (err) {
    console.warn("[intake] new-address write skipped", err);
  }
}
