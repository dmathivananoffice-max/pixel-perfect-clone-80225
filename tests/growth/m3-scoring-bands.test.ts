import { describe, expect, test } from "bun:test";
import bandsJson from "../../src/growth/scoring/config/scoring-bands.v1.json";
import weightsJson from "../../src/growth/scoring/config/scoring-weights.v1.json";
import { computeScore } from "../../src/growth/scoring/engine";
import { SCORE_JOBS } from "../../src/growth/scoring/jobs";
import { loadBands, loadWeights } from "../../src/growth/scoring/loadConfig";
import { createMemoryScoringStore } from "../../src/growth/scoring/memoryStore";
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

describe("M3 strong vs weak bands", () => {
  test("strong and weak land in different bands with readable explanations", () => {
    const strong = computeScore(
      {
        branch: "nursing-professional",
        answers: strongAnswers,
        signals: { diagnostic_completed: true, contact_captured: true },
      },
      weights,
      bands,
    );
    const weak = computeScore(
      {
        branch: "nursing-ausbildung",
        answers: weakAnswers,
        signals: { diagnostic_completed: true },
      },
      weights,
      bands,
    );

    expect(strong.band).not.toBe(weak.band);
    expect(["HOT", "WARM"]).toContain(strong.band);
    expect(weak.band).toBe("DISQUALIFIED");
    expect(strong.explanation.sub_scores.fit.rules_fired.join(",")).toMatch(
      /fit\./,
    );
    expect(weak.explanation.hard_dq_rule).toBeTruthy();
  });

  test("→HOT enqueues counsellor_task; →DQ enqueues dq_message asset_ref", async () => {
    const store = createMemoryScoringStore();
    const queue = new MemoryJobQueue();
    const svc = new ScoringService(weights, bands, store, queue);
    const leadId = crypto.randomUUID();

    await svc.recompute(
      leadId,
      {
        branch: "nursing-professional",
        answers: {
          qualification: "gnm",
          experience_years: "1_3",
          german_level: "A2",
          financial_readiness: "partial",
          timeline_preference: "12_24_months",
          city_state: "kerala",
          registration_status: "active",
        },
        signals: { diagnostic_completed: true },
      },
      "diagnostic_completion",
    );

    await svc.overrideBand({
      lead_id: leadId,
      by_user: crypto.randomUUID(),
      to_band: "HOT",
      reason_code: "DOCUMENT_VERIFIED",
    });
    expect(queue.jobs.some((j) => j.name === SCORE_JOBS.COUNSELLOR_TASK)).toBe(
      true,
    );

    await svc.recompute(
      crypto.randomUUID(),
      {
        branch: "nursing-ausbildung",
        answers: weakAnswers,
        signals: { diagnostic_completed: true },
      },
      "diagnostic_completion",
    );
    const dqJob = queue.jobs.find((j) => j.name === SCORE_JOBS.DQ_MESSAGE);
    expect(dqJob).toBeTruthy();
    expect((dqJob?.payload as { asset_ref: string }).asset_ref).toMatch(
      /^asset:/,
    );
  });
});
