import { describe, expect, test } from "bun:test";
import { loadBranchFromJson } from "../../src/growth/diagnostic/loadBranch";
import nursingProfessional from "../../src/growth/diagnostic/branches/nursing-professional.v1.json";
import nursingAusbildung from "../../src/growth/diagnostic/branches/nursing-ausbildung.v1.json";

describe("branch configs (FR-D-02)", () => {
  test("nursing-professional: 6–9 questions, each affects pathway/band/gaps", () => {
    const branch = loadBranchFromJson(nursingProfessional);
    expect(branch.questions.length).toBeGreaterThanOrEqual(6);
    expect(branch.questions.length).toBeLessThanOrEqual(9);
    for (const q of branch.questions) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(
        q.affects.some((a) => ["pathway", "band", "gaps"].includes(a)),
      ).toBe(true);
    }
  });

  test("nursing-ausbildung: includes age band + german A0–B2", () => {
    const branch = loadBranchFromJson(nursingAusbildung);
    const ids = branch.questions.map((q) => q.id);
    expect(ids).toContain("age_band");
    expect(ids).toContain("german_level");
    const german = branch.questions.find((q) => q.id === "german_level")!;
    const values = german.options.map((o) => o.value);
    expect(values).toEqual(["A0", "A1", "A2", "B1", "B2"]);
  });

  test("rejects question that affects nothing", () => {
    expect(() =>
      loadBranchFromJson({
        version: "x",
        branch: "x",
        title: "x",
        questions: [
          {
            id: "noop",
            prompt: "Hi?",
            affects: [],
            options: [
              { value: "a", label: "A" },
              { value: "b", label: "B" },
            ],
          },
        ],
      }),
    ).toThrow(/affects nothing|6–9/);
  });
});
