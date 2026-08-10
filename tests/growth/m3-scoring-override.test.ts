import { describe, expect, test } from "bun:test";
import bandsJson from "../../src/growth/scoring/config/scoring-bands.v1.json";
import weightsJson from "../../src/growth/scoring/config/scoring-weights.v1.json";
import { SCORE_JOBS } from "../../src/growth/scoring/jobs";
import { loadBands, loadWeights } from "../../src/growth/scoring/loadConfig";
import { createMemoryScoringStore } from "../../src/growth/scoring/memoryStore";
import { validateOverride } from "../../src/growth/scoring/override";
import { MemoryJobQueue } from "../../src/growth/scoring/queue";
import { ScoringService } from "../../src/growth/scoring/service";

const weights = loadWeights(weightsJson);
const bands = loadBands(bandsJson);

const midAnswers = {
  qualification: "gnm",
  experience_years: "1_3",
  german_level: "A2",
  financial_readiness: "partial",
  timeline_preference: "12_24_months",
  city_state: "kerala",
  registration_status: "expired",
};

describe("M3 override reason requirement (FR-S-06)", () => {
  test("rejects missing / unknown reason_code", () => {
    expect(
      validateOverride({
        lead_id: "x",
        by_user: "u",
        from_band: "WARM",
        to_band: "HOT",
        reason_code: "",
      }).ok,
    ).toBe(false);
    expect(
      validateOverride({
        lead_id: "x",
        by_user: "u",
        from_band: "WARM",
        to_band: "HOT",
        reason_code: "BECAUSE_I_SAID_SO",
      }).ok,
    ).toBe(false);
  });

  test("service override requires reason and enqueues HOT task", async () => {
    const store = createMemoryScoringStore();
    const queue = new MemoryJobQueue();
    const svc = new ScoringService(weights, bands, store, queue);
    const midId = crypto.randomUUID();

    await svc.recompute(
      midId,
      {
        branch: "nursing-professional",
        answers: midAnswers,
        signals: { diagnostic_completed: true },
      },
      "diagnostic_completion",
    );

    const denied = await svc.overrideBand({
      lead_id: midId,
      by_user: crypto.randomUUID(),
      to_band: "HOT",
      reason_code: "",
    });
    expect(denied.ok).toBe(false);

    const ok = await svc.overrideBand({
      lead_id: midId,
      by_user: crypto.randomUUID(),
      to_band: "HOT",
      reason_code: "COUNSELLOR_JUDGEMENT",
    });
    expect(ok.ok).toBe(true);
    expect(store.overrides[0]?.reason_code).toBe("COUNSELLOR_JUDGEMENT");
    expect(queue.jobs.some((j) => j.name === SCORE_JOBS.COUNSELLOR_TASK)).toBe(
      true,
    );
  });
});

describe("config starting-value markers", () => {
  test("weights and bands notes mark STARTING VALUES", () => {
    expect(weights.note).toMatch(/STARTING VALUES/i);
    expect(bands.note).toMatch(/STARTING VALUES/i);
  });
});
