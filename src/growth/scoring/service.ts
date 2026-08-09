import { applyAiDelta } from "./applyAiDelta";
import { computeScore } from "./engine";
import { bandTransitionJobs, type RecomputeTrigger } from "./jobs";
import { validateOverride } from "./override";
import type { JobQueue } from "./queue";
import type {
  ComputedScore,
  OverrideReasonCode,
  ScoreBand,
  ScoreInput,
  ScoringBandsConfig,
  ScoringWeightsConfig,
  SubScoreKey,
} from "./types";

export type ScoreRecord = ComputedScore & {
  id: string;
  lead_id: string;
};

export type ScoringStore = {
  getLatestScore(lead_id: string): Promise<ScoreRecord | null>;
  insertScore(lead_id: string, score: ComputedScore): Promise<ScoreRecord>;
  insertOverride(input: {
    lead_id: string;
    by_user: string;
    from_band: ScoreBand;
    to_band: ScoreBand;
    reason_code: OverrideReasonCode;
  }): Promise<void>;
  /** Persist a score row that reflects counsellor override band. */
  insertOverrideScore(
    lead_id: string,
    base: ComputedScore,
    to_band: ScoreBand,
    reason_code: OverrideReasonCode,
  ): Promise<ScoreRecord>;
};

export class ScoringService {
  constructor(
    private weights: ScoringWeightsConfig,
    private bands: ScoringBandsConfig,
    private store: ScoringStore,
    private queue: JobQueue,
  ) {}

  async recompute(
    lead_id: string,
    input: ScoreInput,
    trigger: RecomputeTrigger,
  ): Promise<ScoreRecord> {
    const previous = await this.store.getLatestScore(lead_id);
    const computed = computeScore(input, this.weights, this.bands);
    const saved = await this.store.insertScore(lead_id, computed);

    // Side-effect jobs only — RECOMPUTE is the inbound trigger job, not re-enqueued here.
    void trigger;

    const transitions = bandTransitionJobs(previous?.band ?? null, saved.band, {
      lead_id,
      score_id: saved.id,
      named_gaps: Object.values(saved.explanation.sub_scores)
        .flatMap((s) => s.rules_fired)
        .filter((r) => r.includes("unqualified") || r.includes("class10") || r.includes("no")),
      alternative:
        saved.band === "DISQUALIFIED"
          ? "prep nurture track — revisit after gaps close"
          : null,
    });

    for (const job of transitions) {
      await this.queue.send({ name: job.name, payload: job.payload });
    }

    return saved;
  }

  async applyDelta(
    lead_id: string,
    deltas: Partial<Record<SubScoreKey, number>>,
  ) {
    const current = await this.store.getLatestScore(lead_id);
    if (!current) {
      return { ok: false as const, error: "no score for lead" };
    }
    const result = applyAiDelta({
      current,
      deltas,
      weights: this.weights,
      bands: this.bands,
    });
    if (!result.ok) return result;
    const saved = await this.store.insertScore(lead_id, result.score);
    return { ok: true as const, score: saved, clamped: result.clamped };
  }

  async overrideBand(input: {
    lead_id: string;
    by_user: string;
    to_band: ScoreBand;
    reason_code: string;
  }) {
    const current = await this.store.getLatestScore(input.lead_id);
    if (!current) {
      return { ok: false as const, error: "no score for lead" };
    }
    const validation = validateOverride({
      lead_id: input.lead_id,
      by_user: input.by_user,
      from_band: current.band,
      to_band: input.to_band,
      reason_code: input.reason_code,
    });
    if (!validation.ok) return validation;

    await this.store.insertOverride({
      lead_id: input.lead_id,
      by_user: input.by_user,
      from_band: current.band,
      to_band: input.to_band,
      reason_code: validation.reason_code,
    });

    const saved = await this.store.insertOverrideScore(
      input.lead_id,
      current,
      input.to_band,
      validation.reason_code,
    );

    const transitions = bandTransitionJobs(current.band, input.to_band, {
      lead_id: input.lead_id,
      score_id: saved.id,
    });
    for (const job of transitions) {
      await this.queue.send({ name: job.name, payload: job.payload });
    }

    return { ok: true as const, score: saved };
  }
}
