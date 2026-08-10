import { describe, expect, test } from "bun:test";
import { applyAiDelta, clampDelta } from "../../src/growth/scoring/applyAiDelta";
import bandsJson from "../../src/growth/scoring/config/scoring-bands.v1.json";
import weightsJson from "../../src/growth/scoring/config/scoring-weights.v1.json";
import { computeScore } from "../../src/growth/scoring/engine";
import { loadBands, loadWeights } from "../../src/growth/scoring/loadConfig";

const weights = loadWeights(weightsJson);
const bands = loadBands(bandsJson);

const strongAnswers = {
  qualification: "bsc_nursing",
  experience_years: "3_5",
  german_level: "B1",
  financial_readiness: "funded",
  timeline_preference: "within_12_months",
  city_state: "kerala",
  registration_status: "active",
};

describe("M3 scoring explanation (FR-S-01)", () => {
  test("explanation includes rules fired, inputs, weights_version", () => {
    const score = computeScore(
      {
        branch: "nursing-professional",
        answers: strongAnswers,
        signals: { diagnostic_completed: true, contact_captured: true },
      },
      weights,
      bands,
    );

    expect(score.weights_version).toBe(weights.version);
    expect(score.explanation.weights_version).toBe(weights.version);
    expect(score.explanation.thresholds_version).toBe(bands.version);
    expect(score.explanation.inputs.answers.qualification).toBe("bsc_nursing");
    for (const key of ["fit", "intent", "capability", "timing", "engagement"] as const) {
      expect(score.explanation.sub_scores[key].rules_fired.length).toBeGreaterThan(0);
      expect(score.explanation.sub_scores[key].value).toBeGreaterThanOrEqual(0);
    }
    expect(score.band).not.toBe("DISQUALIFIED");
  });
});

describe("M3 clamp behaviour (FR-S-05)", () => {
  test("clampDelta bounds to ±15", () => {
    expect(clampDelta(100)).toBe(15);
    expect(clampDelta(-40)).toBe(-15);
    expect(clampDelta(7)).toBe(7);
  });

  test("applyAiDelta clamps oversized proposals", () => {
    const current = computeScore(
      {
        branch: "nursing-professional",
        answers: strongAnswers,
        signals: { diagnostic_completed: true },
      },
      weights,
      bands,
    );
    const result = applyAiDelta({
      current,
      deltas: { fit: 50, intent: -30 },
      weights,
      bands,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.clamped.fit).toBe(15);
    expect(result.clamped.intent).toBe(-15);
    expect(result.score.explanation.ai_proposed?.clamped.fit).toBe(15);
  });
});

