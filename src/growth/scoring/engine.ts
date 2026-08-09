import {
  clamp100,
  scoreCapability,
  scoreEngagement,
  scoreFit,
  scoreIntent,
  scoreTiming,
} from "./subScores";
import type {
  ComputedScore,
  ScoreBand,
  ScoreExplanation,
  ScoreInput,
  ScoreSignals,
  ScoringBandsConfig,
  ScoringWeightsConfig,
  SubScoreBreakdown,
  SubScoreKey,
} from "./types";

function hardDqMatch(
  bands: ScoringBandsConfig,
  branch: string,
  answers: Record<string, string>,
): string | null {
  for (const rule of bands.hard_dq) {
    if (rule.branch && rule.branch !== branch) continue;
    let ok = true;
    for (const [key, expected] of Object.entries(rule.when)) {
      const actual = answers[key];
      if (Array.isArray(expected)) {
        if (!expected.includes(actual)) ok = false;
      } else if (actual !== expected) {
        ok = false;
      }
    }
    if (ok) return rule.id;
  }
  return null;
}

export function bandFromComposite(
  composite: number,
  bands: ScoringBandsConfig,
  hardDq: string | null,
): ScoreBand {
  if (hardDq) return "DISQUALIFIED";
  const t = bands.thresholds;
  if (composite >= t.HOT) return "HOT";
  if (composite >= t.WARM) return "WARM";
  if (composite >= t.NURTURE) return "NURTURE";
  return "DISQUALIFIED";
}

/** Deterministic composite score (FR-S-01, FR-S-02). */
export function computeScore(
  input: ScoreInput,
  weights: ScoringWeightsConfig,
  bands: ScoringBandsConfig,
): ComputedScore {
  const answers = { ...input.answers };
  const signals: ScoreSignals = { ...(input.signals ?? {}) };
  const branch = input.branch;

  const sub: Record<SubScoreKey, SubScoreBreakdown> = {
    fit: scoreFit(branch, answers),
    intent: scoreIntent(answers),
    capability: scoreCapability(answers),
    timing: scoreTiming(answers),
    engagement: scoreEngagement(signals),
  };

  const composite = clamp100(
    sub.fit.value * weights.weights.fit +
      sub.intent.value * weights.weights.intent +
      sub.capability.value * weights.weights.capability +
      sub.timing.value * weights.weights.timing +
      sub.engagement.value * weights.weights.engagement,
  );

  const hard_dq_rule = hardDqMatch(bands, branch, answers);
  const band = bandFromComposite(composite, bands, hard_dq_rule);

  const explanation: ScoreExplanation = {
    weights_version: weights.version,
    thresholds_version: bands.version,
    inputs: { branch, answers, signals },
    sub_scores: sub,
    composite,
    band,
    hard_dq_rule,
  };

  return {
    fit: sub.fit.value,
    intent: sub.intent.value,
    capability: sub.capability.value,
    timing: sub.timing.value,
    engagement: sub.engagement.value,
    composite,
    band,
    weights_version: weights.version,
    explanation,
  };
}
