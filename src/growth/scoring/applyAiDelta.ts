import { bandFromComposite } from "./engine";
import { clamp100 } from "./subScores";
import type {
  ComputedScore,
  ScoringBandsConfig,
  ScoringWeightsConfig,
  SubScoreKey,
} from "./types";

const SUBS: SubScoreKey[] = [
  "fit",
  "intent",
  "capability",
  "timing",
  "engagement",
];

export type AiDeltaInput = {
  current: ComputedScore;
  deltas: Partial<Record<SubScoreKey, number>>;
  weights: ScoringWeightsConfig;
  bands: ScoringBandsConfig;
};

export type AiDeltaResult =
  | {
      ok: true;
      score: ComputedScore;
      clamped: Partial<Record<SubScoreKey, number>>;
    }
  | {
      ok: false;
      error: string;
      refused_dq_transition: boolean;
      clamped: Partial<Record<SubScoreKey, number>>;
    };

/** Clamp each delta to ±15 (FR-S-05). */
export function clampDelta(delta: number): number {
  if (!Number.isFinite(delta)) return 0;
  return Math.max(-15, Math.min(15, delta));
}

/**
 * Apply AI-proposed score deltas (FR-S-05).
 * Clamps ±15; REFUSES any transition into or out of DISQUALIFIED.
 */
export function applyAiDelta(input: AiDeltaInput): AiDeltaResult {
  const clamped: Partial<Record<SubScoreKey, number>> = {};
  const nextValues: Record<SubScoreKey, number> = {
    fit: input.current.fit,
    intent: input.current.intent,
    capability: input.current.capability,
    timing: input.current.timing,
    engagement: input.current.engagement,
  };

  for (const key of SUBS) {
    const raw = input.deltas[key];
    if (raw == null) continue;
    const c = clampDelta(raw);
    clamped[key] = c;
    nextValues[key] = clamp100(nextValues[key] + c);
  }

  const composite = clamp100(
    nextValues.fit * input.weights.weights.fit +
      nextValues.intent * input.weights.weights.intent +
      nextValues.capability * input.weights.weights.capability +
      nextValues.timing * input.weights.weights.timing +
      nextValues.engagement * input.weights.weights.engagement,
  );

  const priorBand = input.current.band;
  const hardDq = input.current.explanation.hard_dq_rule;
  const nextBand = bandFromComposite(composite, input.bands, hardDq);

  const priorDq = priorBand === "DISQUALIFIED";
  const nextDq = nextBand === "DISQUALIFIED";
  if (priorDq !== nextDq) {
    return {
      ok: false,
      error: priorDq
        ? "AI delta refused: cannot transition out of DISQUALIFIED"
        : "AI delta refused: cannot transition into DISQUALIFIED",
      refused_dq_transition: true,
      clamped,
    };
  }

  const explanation = {
    ...input.current.explanation,
    sub_scores: { ...input.current.explanation.sub_scores },
    composite,
    band: nextBand,
    ai_proposed: {
      deltas: { ...input.deltas },
      clamped,
      refused_dq_transition: false,
    },
  };

  for (const key of SUBS) {
    if (clamped[key] == null) continue;
    explanation.sub_scores[key] = {
      value: nextValues[key],
      rules_fired: [
        ...input.current.explanation.sub_scores[key].rules_fired,
        `ai_delta.${key}:${clamped[key]}`,
      ],
    };
  }

  return {
    ok: true,
    clamped,
    score: {
      fit: nextValues.fit,
      intent: nextValues.intent,
      capability: nextValues.capability,
      timing: nextValues.timing,
      engagement: nextValues.engagement,
      composite,
      band: nextBand,
      weights_version: input.weights.version,
      explanation,
    },
  };
}
