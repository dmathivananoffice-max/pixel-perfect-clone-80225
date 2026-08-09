import { describe, expect, test } from "bun:test";
import { filterOutbound, regexFilter } from "../../src/growth/whatsapp/filter";

describe("M4 FR-W-10 output filter", () => {
  test("blocks visa success probability class", async () => {
    const samples = [
      "Your visa is guaranteed with our program.",
      "There is a 90% chance you get a visa.",
      "High chance of a visa approval for you.",
    ];
    for (const s of samples) {
      expect(regexFilter(s)).toContain("visa_probability");
      const r = await filterOutbound(s);
      expect(r.blocked).toBe(true);
      if (r.blocked) expect(r.fallback_text.length).toBeGreaterThan(20);
    }
  });

  test("blocks employment promises", async () => {
    const samples = [
      "You will get a job in Germany.",
      "We will place you a job within weeks.",
      "Guaranteed employment after arrival.",
    ];
    for (const s of samples) {
      expect(regexFilter(s)).toContain("employment_promise");
      expect((await filterOutbound(s)).blocked).toBe(true);
    }
  });

  test("blocks guaranteed salary", async () => {
    const samples = [
      "Guaranteed salary of €3500.",
      "You will definitely earn €3000.",
      "The salary is guaranteed.",
    ];
    for (const s of samples) {
      const hits = regexFilter(s);
      expect(
        hits.includes("guaranteed_salary") || hits.includes("certainty_phrasing"),
      ).toBe(true);
      expect((await filterOutbound(s)).blocked).toBe(true);
    }
  });

  test("blocks certainty phrasing", async () => {
    for (const s of [
      "You will definitely succeed.",
      "This is 100% safe.",
      "Results are guaranteed.",
    ]) {
      expect(regexFilter(s)).toContain("certainty_phrasing");
      expect((await filterOutbound(s)).blocked).toBe(true);
    }
  });

  test("allows educational not-guaranteed FAQ wording", async () => {
    const safe =
      "No one can guarantee a visa outcome. We help you prepare a complete file.";
    expect(regexFilter(safe)).not.toContain("certainty_phrasing");
    expect((await filterOutbound(safe)).blocked).toBe(false);
  });
});
