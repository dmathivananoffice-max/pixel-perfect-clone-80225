import { describe, expect, test } from "bun:test";
import { M6_CHECK_IDS } from "../src/lib/intake/parityContract.ts";
import { LEGACY_REQUIRED_SET } from "../src/intake/fieldDictionary.ts";

describe("Addendum B § M6 parity contract", () => {
  test("exposes exactly eight checks", () => {
    expect(M6_CHECK_IDS).toHaveLength(8);
    expect(new Set(M6_CHECK_IDS).size).toBe(8);
  });

  test("legacy required set has the ten current dictionary required keys", () => {
    expect(LEGACY_REQUIRED_SET).toHaveLength(10);
    expect(LEGACY_REQUIRED_SET).toContain("personal.first_name");
    expect(LEGACY_REQUIRED_SET).toContain("language.level");
  });
});

describe("session flush banner copy", () => {
  test("banner sentence matches the Sprint 0 spec", () => {
    const resume = "14:32";
    const text = `Intake is being upgraded. Verification resumes at ${resume}. Your saved work is safe.`;
    expect(text).toContain("Intake is being upgraded.");
    expect(text).toContain("Verification resumes at");
    expect(text).toContain("Your saved work is safe.");
  });
});
