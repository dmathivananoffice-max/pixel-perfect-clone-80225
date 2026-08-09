/**
 * Part A — write determinism test FIRST (FR-D-06).
 * Same branch + answers → byte-identical output; rules_version stamped.
 */
import { describe, expect, test } from "bun:test";
import { evaluateDiagnostic } from "../../src/growth/diagnostic/engine";
import { loadRulesFromJson } from "../../src/growth/diagnostic/loadRules";
import nursingProfessionalRules from "../../src/growth/diagnostic/rules/nursing-professional.v1.json";
import nursingAusbildungRules from "../../src/growth/diagnostic/rules/nursing-ausbildung.v1.json";

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.keys(v as object)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (v as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return v;
  });
}

describe("evaluateDiagnostic determinism (FR-D-06)", () => {
  const rules = loadRulesFromJson(nursingProfessionalRules);

  const readyAnswers = {
    qualification: "bsc_nursing",
    experience_years: "3_5",
    german_level: "B1",
    financial_readiness: "funded",
    timeline_preference: "within_12_months",
    city_state: "kerala",
  };

  test("same input → byte-identical output", () => {
    const a = evaluateDiagnostic({
      branch: "nursing-professional",
      answers: readyAnswers,
      rules,
    });
    const b = evaluateDiagnostic({
      branch: "nursing-professional",
      answers: { ...readyAnswers },
      rules,
    });

    expect(stableStringify(a)).toBe(stableStringify(b));
    expect(a.rules_version).toBe(rules.version);
    expect(a.rules_version.length).toBeGreaterThan(0);
  });

  test("100 repeated evaluations stay byte-identical", () => {
    const first = stableStringify(
      evaluateDiagnostic({
        branch: "nursing-professional",
        answers: readyAnswers,
        rules,
      }),
    );
    for (let i = 0; i < 100; i++) {
      const next = stableStringify(
        evaluateDiagnostic({
          branch: "nursing-professional",
          answers: { ...readyAnswers },
          rules,
        }),
      );
      expect(next).toBe(first);
    }
  });

  test("answer key order does not affect output", () => {
    const rulesLocal = loadRulesFromJson(nursingProfessionalRules);
    const left = evaluateDiagnostic({
      branch: "nursing-professional",
      answers: {
        city_state: "kerala",
        qualification: "bsc_nursing",
        german_level: "B1",
        experience_years: "3_5",
        timeline_preference: "within_12_months",
        financial_readiness: "funded",
      },
      rules: rulesLocal,
    });
    const right = evaluateDiagnostic({
      branch: "nursing-professional",
      answers: readyAnswers,
      rules: rulesLocal,
    });
    expect(stableStringify(left)).toBe(stableStringify(right));
  });

  test("unqualified set → honest NOT_YET with named gaps (not encouragement)", () => {
    const ausbildung = loadRulesFromJson(nursingAusbildungRules);
    const result = evaluateDiagnostic({
      branch: "nursing-ausbildung",
      answers: {
        qualification: "class_10",
        german_level: "A0",
        financial_readiness: "not_ready",
        timeline_preference: "unsure",
        city_state: "other",
        age_band: "30_plus",
      },
      rules: ausbildung,
    });

    expect(result.band).toBe("NOT_YET");
    expect(result.gaps.length).toBeGreaterThan(0);
    expect(result.gaps.every((g) => typeof g === "string" && g.length > 0)).toBe(
      true,
    );
    expect(result.preparation_path?.length).toBeGreaterThan(0);
    expect(result.nurture_track).toBeTruthy();
    const blob = stableStringify(result).toLowerCase();
    expect(blob.includes("you are ready")).toBe(false);
    expect(blob.includes("guaranteed")).toBe(false);
    expect(result.rules_version).toBe(ausbildung.version);
  });
});
