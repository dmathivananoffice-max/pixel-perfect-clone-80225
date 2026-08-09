import type { ScoreRecord, ScoringStore } from "./service";
import type { ComputedScore, OverrideReasonCode, ScoreBand } from "./types";

export function createMemoryScoringStore(): ScoringStore & {
  overrides: Array<{
    lead_id: string;
    reason_code: OverrideReasonCode;
    from_band: ScoreBand;
    to_band: ScoreBand;
  }>;
} {
  const scores = new Map<string, ScoreRecord[]>();
  const overrides: Array<{
    lead_id: string;
    reason_code: OverrideReasonCode;
    from_band: ScoreBand;
    to_band: ScoreBand;
  }> = [];

  return {
    overrides,
    async getLatestScore(lead_id) {
      const list = scores.get(lead_id) ?? [];
      return list[list.length - 1] ?? null;
    },
    async insertScore(lead_id, score) {
      const row: ScoreRecord = { ...score, id: crypto.randomUUID(), lead_id };
      const list = scores.get(lead_id) ?? [];
      list.push(row);
      scores.set(lead_id, list);
      return row;
    },
    async insertOverride(input) {
      overrides.push(input);
    },
    async insertOverrideScore(lead_id, base, to_band, reason_code) {
      const score: ComputedScore = {
        ...base,
        band: to_band,
        explanation: {
          ...base.explanation,
          band: to_band,
        },
      };
      (score.explanation as { override?: { reason_code: string } }).override = {
        reason_code,
      };
      return this.insertScore(lead_id, score);
    },
  };
}
