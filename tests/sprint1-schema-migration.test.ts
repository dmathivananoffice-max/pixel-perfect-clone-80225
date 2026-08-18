import { describe, expect, test, beforeEach } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BACKFILL_EDUCATION_LEVEL,
  BACKFILL_GRADE_SCALE,
  BACKFILL_OVERALL_RESULT,
  LEGACY_KEY_MAP,
  ReadOnlyAliasError,
  getAliasResolutionCount,
  hasLegacyEducationData,
  hasLegacyLanguageData,
  projectWritesToNewAddresses,
  readFromNewAddress,
  resetAliasResolutionCount,
  resolveLegacyKey,
  strongestHumanStatus,
  writeTargetForLegacyKey,
} from "../src/intake/keyAliases.ts";
import { computeReadinessPct } from "../src/lib/intake/readinessCompute.ts";

const PHASE1 = readFileSync(
  resolve("supabase/migrations/20260818010000_sprint1_phase1_unused_tables.sql"),
  "utf8",
);
const PHASE2 = readFileSync(
  resolve("supabase/migrations/20260818020000_sprint1_phase2_backfill.sql"),
  "utf8",
);
const PHASE3 = readFileSync(
  resolve("supabase/migrations/20260818030000_sprint1_phase3_sync_triggers.sql"),
  "utf8",
);
const ROLLBACK = readFileSync(resolve("supabase/sql/sprint1_window_rollback.sql"), "utf8");

describe("Sprint 1 Addendum B § M2.1 / M3.1 unused tables", () => {
  test("Phase 1 creates the three unused tables", () => {
    expect(PHASE1).toContain("CREATE TABLE IF NOT EXISTS public.intake_education_records");
    expect(PHASE1).toContain("CREATE TABLE IF NOT EXISTS public.intake_language_certificates");
    expect(PHASE1).toContain("CREATE TABLE IF NOT EXISTS public.intake_language_modules");
    expect(PHASE1).toContain("CREATE OR REPLACE VIEW public.intake_field_values");
    expect(PHASE1).toContain("DEFAULT 'unknown'");
    expect(PHASE1).toContain("DEFAULT 'other'");
  });
});

describe("Sprint 1 Addendum B § M2.2 / M3.2 backfill (verbatim literals)", () => {
  test("education level stays unknown — do not classify", () => {
    expect(BACKFILL_EDUCATION_LEVEL).toBe("unknown");
    expect(PHASE2).toMatch(/'unknown',\s*'other'/);
    expect(PHASE2).not.toMatch(/level\s*=\s*'bachelor'/i);
    expect(PHASE2).toContain("do NOT classify during backfill");
  });

  test("grade_scale stays other — do not infer the scale", () => {
    expect(BACKFILL_GRADE_SCALE).toBe("other");
    expect(PHASE2).toContain("do NOT infer the scale");
  });

  test("language overall_result stays unknown — do not set passed", () => {
    expect(BACKFILL_OVERALL_RESULT).toBe("unknown");
    expect(PHASE2).toContain("'unknown'");
    expect(PHASE2).toContain("do NOT set 'passed'");
    expect(PHASE2).not.toMatch(/overall_result,\s*'passed'/);
  });

  test("strongest human status on any legacy field becomes the record status", () => {
    expect(strongestHumanStatus(["pending", "human_edited", "verified"])).toBe("verified");
    expect(strongestHumanStatus(["ai_high", "human_edited"])).toBe("human_edited");
    expect(strongestHumanStatus(["pending", "flagged"])).toBe("pending");
    expect(PHASE2).toContain("AND f.status IN ('verified', 'human_edited')");
    expect(PHASE2).toContain("ORDER BY public.intake_human_status_rank(f.status) DESC");
  });

  test("candidates with no legacy data get NO record", () => {
    expect(hasLegacyEducationData({})).toBe(false);
    expect(hasLegacyEducationData({ qualification: "  " })).toBe(false);
    expect(hasLegacyEducationData({ qualification: "BSc Nursing" })).toBe(true);
    expect(hasLegacyLanguageData({})).toBe(false);
    expect(hasLegacyLanguageData({ exam_date: "2024-01-01" })).toBe(true);
    expect(projectWritesToNewAddresses({})).toEqual({ education: null, language: null });
    expect(PHASE2).toContain("Candidates with no legacy data get NO record");
    expect(PHASE2).toContain("WHERE EXISTS");
  });
});

describe("Sprint 1 Addendum B § M2.3 / M3.3 ordinal-0 sync", () => {
  test("Phase 3 writes ordinal-0 back to legacy keys", () => {
    expect(PHASE3).toContain("IF v_ordinal <> 0 THEN");
    expect(PHASE3).toContain("education.qualification");
    expect(PHASE3).toContain("language.provider");
    expect(PHASE3).toContain("language.exam_date");
    expect(PHASE3).toContain("trg_sync_education_record_to_legacy");
    expect(PHASE3).toContain("trg_sync_language_certificate_to_legacy");
    expect(PHASE3).toContain("trg_sync_language_module_to_legacy");
  });

  test("window rollback drops triggers and clears backfill", () => {
    expect(ROLLBACK).toContain("DROP TRIGGER IF EXISTS trg_sync_education_record_to_legacy");
    expect(ROLLBACK).toContain("DELETE FROM public.intake_education_records");
    expect(ROLLBACK).toContain("Do not patch forward");
  });
});

describe("Sprint 1 Addendum B § M4 LEGACY_KEY_MAP", () => {
  beforeEach(() => {
    resetAliasResolutionCount();
  });

  test("maps every education and language dictionary key", () => {
    expect(Object.keys(LEGACY_KEY_MAP).sort()).toEqual(
      [
        "education.gpa",
        "education.institution",
        "education.qualification",
        "education.year",
        "language.cert_date",
        "language.exam_date",
        "language.level",
        "language.provider",
      ].sort(),
    );
  });

  test("writes go to the new address only (ordinal 0)", () => {
    const q = writeTargetForLegacyKey("education.qualification");
    expect(q?.table).toBe("intake_education_records");
    expect(q?.column).toBe("qualification");
    expect(q?.ordinal).toBe(0);
    expect(q?.writable).toBe(true);

    const projected = projectWritesToNewAddresses({
      education: { qualification: "BSc" },
      language: { level: "B2", exam_date: "2024-06-01" },
    });
    expect(projected.education?.table).toBe("intake_education_records");
    expect(projected.language?.table).toBe("intake_language_certificates");
    expect(projected.language).not.toHaveProperty("exam_date");
  });

  test("language.exam_date is read-only because it fans out", () => {
    const target = resolveLegacyKey("language.exam_date");
    expect(target?.writable).toBe(false);
    expect(target?.table).toBe("intake_language_modules");
    expect(() => writeTargetForLegacyKey("language.exam_date")).toThrow(ReadOnlyAliasError);
  });

  test("increments a counter on every resolution", () => {
    expect(getAliasResolutionCount()).toBe(0);
    resolveLegacyKey("education.qualification");
    resolveLegacyKey("language.exam_date");
    resolveLegacyKey("personal.first_name");
    expect(getAliasResolutionCount()).toBe(3);
    expect(readFromNewAddress("education.gpa", { gpa: "3.8" })).toBe("3.8");
    expect(getAliasResolutionCount()).toBe(4);
  });

  test("alias resolution does not change readiness_pct", () => {
    const extracted = {
      personal: { first_name: "Ada", last_name: "Lovelace", dob: "1815-12-10", nationality: "British" },
      passport: { passport_no: "P1", expiry_date: "2030-01-01" },
      contact: { email: "ada@example.com", phone: "123" },
      education: { qualification: "BSc" },
      language: { level: "B2" },
    };
    const before = computeReadinessPct(extracted, 1);
    resolveLegacyKey("education.qualification");
    resolveLegacyKey("language.level");
    const after = computeReadinessPct(extracted, 1);
    expect(after.pct).toBe(before.pct);
    expect(after.pct).toBe(100);
  });
});
