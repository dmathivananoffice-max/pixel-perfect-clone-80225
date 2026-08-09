import { describe, expect, test } from "bun:test";
import { applyAiDelta, clampDelta } from "../../src/growth/scoring/applyAiDelta";
import bandsJson from "../../src/growth/scoring/config/scoring-bands.v1.json";
import weightsJson from "../../src/growth/scoring/config/scoring-weights.v1.json";
import { computeScore } from "../../src/growth/scoring/engine";
import { SCORE_JOBS } from "../../src/growth/scoring/jobs";
import { loadBands, loadWeights } from "../../src/growth/scoring/loadConfig";
import { createMemoryScoringStore } from "../../src/growth/scoring/memoryStore";
import { validateOverride } from "../../src/growth/scoring/override";
import { MemoryJobQueue } from "../../src/growth/scoring/queue";
import { ScoringService } from "../../src/growth/scoring/service";

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

const weakAnswers = {
  qualification: "class_10",
  age_band: "30_plus",
  german_level: "A0",
  financial_readiness: "not_ready",
  timeline_preference: "unsure",
  city_state: "other",
  parent_support: "no",
  science_background: "no",
};

describe("M3 DQ protection (FR-S-05)", () => {
  test("refuses transition into DISQUALIFIED", () => {
    // Synthetic NURTURE score just above DQ threshold (35)
    const current = computeScore(
      {
        branch: "nursing-professional",
        answers: {
          qualification: "gnm",
          experience_years: "0_1",
          german_level: "A2",
          financial_readiness: "partial",
          timeline_preference: "unsure",
          city_state: "kerala",
          registration_status: "expired",
        },
        signals: {},
      },
      weights,
      bands,
    );
    expect(current.band).not.toBe("DISQUALIFIED");

    const borderline = {
      ...current,
      fit: 40,
      intent: 40,
      capability: 40,
      timing: 40,
      engagement: 40,
      composite: 40,
      band: "NURTURE" as const,
      explanation: {
        ...current.explanation,
        hard_dq_rule: null,
        band: "NURTURE" as const,
        composite: 40,
      },
    };

    const result = applyAiDelta({
      current: borderline,
      deltas: {
        fit: -15,
        intent: -15,
        capability: -15,
        timing: -15,
        engagement: -15,
      },
      weights,
      bands,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refused_dq_transition).toBe(true);
    expect(result.error).toMatch(/into DISQUALIFIED/);
  });

  test("refuses transition out of DISQUALIFIED", () => {
    const current = computeScore(
      {
        branch: "nursing-ausbildung",
        answers: weakAnswers,
        signals: { diagnostic_completed: true },
      },
      weights,
      bands,
    );
    expect(current.band).toBe("DISQUALIFIED");

    const result = applyAiDelta({
      current,
      deltas: {
        fit: 15,
        intent: 15,
        capability: 15,
        timing: 15,
        engagement: 15,
      },
      weights,
      bands,
    });
    // hard_dq keeps them in DQ — natural band still DQ, so apply may succeed while staying DQ
    // Force a case: clear hard_dq and set band DQ via low composite only
    const synthetic = {
      ...current,
      band: "DISQUALIFIED" as const,
      explanation: {
        ...current.explanation,
        hard_dq_rule: null,
        band: "DISQUALIFIED" as const,
      },
      fit: 20,
      intent: 20,
      capability: 20,
      timing: 20,
      engagement: 20,
      composite: 20,
    };
    const out = applyAiDelta({
      current: synthetic,
      deltas: {
        fit: 15,
        intent: 15,
        capability: 15,
        timing: 15,
        engagement: 15,
      },
      weights,
      bands,
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.refused_dq_transition).toBe(true);
    expect(out.error).toMatch(/out of DISQUALIFIED/);
  });
});

