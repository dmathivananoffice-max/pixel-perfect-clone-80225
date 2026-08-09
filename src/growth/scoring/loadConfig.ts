import type { ScoringBandsConfig, ScoringWeightsConfig, SubScoreKey } from "./types";

const KEYS: SubScoreKey[] = [
  "fit",
  "intent",
  "capability",
  "timing",
  "engagement",
];

export function loadWeights(raw: unknown): ScoringWeightsConfig {
  if (!raw || typeof raw !== "object") throw new Error("weights config required");
  const w = raw as ScoringWeightsConfig;
  if (!w.version) throw new Error("weights.version required");
  let sum = 0;
  for (const k of KEYS) {
    const v = w.weights?.[k];
    if (typeof v !== "number" || v < 0) {
      throw new Error(`weights.${k} must be a non-negative number`);
    }
    sum += v;
  }
  if (Math.abs(sum - 1) > 0.001) {
    throw new Error(`weights must sum to 1 (got ${sum})`);
  }
  return {
    version: w.version,
    note: w.note ?? "",
    weights: { ...w.weights },
  };
}

export function loadBands(raw: unknown): ScoringBandsConfig {
  if (!raw || typeof raw !== "object") throw new Error("bands config required");
  const b = raw as ScoringBandsConfig;
  if (!b.version) throw new Error("bands.version required");
  const t = b.thresholds;
  if (
    typeof t?.HOT !== "number" ||
    typeof t?.WARM !== "number" ||
    typeof t?.NURTURE !== "number"
  ) {
    throw new Error("bands.thresholds HOT/WARM/NURTURE required");
  }
  if (!(t.HOT > t.WARM && t.WARM > t.NURTURE && t.NURTURE >= 0)) {
    throw new Error("thresholds must satisfy HOT > WARM > NURTURE >= 0");
  }
  return {
    version: b.version,
    note: b.note ?? "",
    thresholds: { ...t },
    hard_dq: Array.isArray(b.hard_dq) ? b.hard_dq : [],
  };
}
