/** M3 lead scoring types (FR-S-01 … FR-S-06). */

export type ScoreBand = "HOT" | "WARM" | "NURTURE" | "DISQUALIFIED";

export type SubScoreKey =
  | "fit"
  | "intent"
  | "capability"
  | "timing"
  | "engagement";

export type SubScoreBreakdown = {
  value: number;
  rules_fired: string[];
};

export type ScoreExplanation = {
  weights_version: string;
  thresholds_version: string;
  inputs: {
    branch: string;
    answers: Record<string, string>;
    signals: ScoreSignals;
  };
  sub_scores: Record<SubScoreKey, SubScoreBreakdown>;
  composite: number;
  band: ScoreBand;
  hard_dq_rule: string | null;
  ai_proposed?: {
    deltas: Partial<Record<SubScoreKey, number>>;
    clamped: Partial<Record<SubScoreKey, number>>;
    refused_dq_transition: boolean;
  };
};

export type ScoreSignals = {
  diagnostic_completed?: boolean;
  contact_captured?: boolean;
  message_count?: number;
  booking?: boolean;
};

export type ScoreInput = {
  branch: string;
  answers: Record<string, string>;
  signals?: ScoreSignals;
};

export type ComputedScore = {
  fit: number;
  intent: number;
  capability: number;
  timing: number;
  engagement: number;
  composite: number;
  band: ScoreBand;
  weights_version: string;
  explanation: ScoreExplanation;
};

export type ScoringWeightsConfig = {
  version: string;
  /** STARTING VALUES — tune via growth.config, do not hardcode in call sites. */
  note: string;
  weights: Record<SubScoreKey, number>;
};

export type ScoringBandsConfig = {
  version: string;
  note: string;
  /** Inclusive lower bounds for composite → band (HOT checked first). */
  thresholds: {
    HOT: number;
    WARM: number;
    NURTURE: number;
  };
  /** Hard DQ rules: if any match, band = DISQUALIFIED regardless of composite. */
  hard_dq: Array<{
    id: string;
    branch?: string;
    when: Record<string, string | string[]>;
  }>;
};

export const OVERRIDE_REASON_CODES = [
  "COUNSELLOR_JUDGEMENT",
  "DATA_CORRECTION",
  "FAMILY_CONTEXT",
  "DOCUMENT_VERIFIED",
  "OTHER",
] as const;

export type OverrideReasonCode = (typeof OVERRIDE_REASON_CODES)[number];
