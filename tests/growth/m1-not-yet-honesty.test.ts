import { describe, expect, test } from "bun:test";
import { evaluateDiagnostic } from "../../src/growth/diagnostic/engine";
import { loadRulesFromJson } from "../../src/growth/diagnostic/loadRules";
import nursingAusbildungRules from "../../src/growth/diagnostic/rules/nursing-ausbildung.v1.json";

describe("NOT_YET honesty (FR-D-09, acceptance)", () => {
  test("deliberately unqualified answers → NOT_YET with named gaps, no false encouragement", () => {
    const rules = loadRulesFromJson(nursingAusbildungRules);
    const result = evaluateDiagnostic({
      branch: "nursing-ausbildung",
      answers: {
        qualification: "class_10",
        age_band: "30_plus",
        german_level: "A0",
        financial_readiness: "not_ready",
        timeline_preference: "unsure",
        city_state: "other",
        parent_support: "no",
        science_background: "no",
      },
      rules,
    });

    expect(result.band).toBe("NOT_YET");
    expect(result.gaps).toEqual(
      expect.arrayContaining([
        "Class 12 (or equivalent) not completed",
        "German below A2",
        "Funding plan not yet in place",
        "Age band above typical Ausbildung intake",
        "Family support not yet in place",
        "No Class 12 science background",
      ]),
    );
    expect(result.preparation_path.length).toBeGreaterThan(0);
    expect(result.nurture_track).toBe("prep-ausbildung-foundation");

    const text = JSON.stringify(result).toLowerCase();
    for (const banned of [
      "you are ready",
      "congratulations",
      "guaranteed",
      "almost there",
      "great news",
    ]) {
      expect(text.includes(banned)).toBe(false);
    }
  });
});
