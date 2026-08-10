import type {
  DiagnosticResult,
  DiagnosticRule,
  DiagnosticRulesConfig,
  EligibilityBand,
  EvaluateInput,
} from "./types";

function matchesRule(
  when: DiagnosticRule["when"],
  answers: Record<string, string>,
): boolean {
  const value = answers[when.answer_key];
  if (value == null) return false;
  if (when.equals != null) return value === when.equals;
  if (when.in != null) return when.in.includes(value);
  if (when.not_in != null) return !when.not_in.includes(value);
  return false;
}

function worseBand(
  current: EligibilityBand,
  candidate: EligibilityBand,
  priority: EligibilityBand[],
): EligibilityBand {
  const ci = priority.indexOf(current);
  const ni = priority.indexOf(candidate);
  // Lower index in band_priority = more restrictive (NOT_YET first)
  if (ni === -1) return current;
  if (ci === -1) return candidate;
  return ni < ci ? candidate : current;
}

function uniqueSorted(items: string[]): string[] {
  return [...new Set(items)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Deterministic eligibility engine (FR-D-06).
 * Never calls an LLM. Same answers + rules_version → byte-identical result.
 */
export function evaluateDiagnostic(input: EvaluateInput): DiagnosticResult {
  const { branch, rules } = input;
  if (rules.branch !== branch) {
    throw new Error(
      `rules.branch mismatch: rules=${rules.branch} input=${branch}`,
    );
  }

  // Normalise answer key order for evaluation stability
  const answers = Object.keys(input.answers)
    .sort()
    .reduce<Record<string, string>>((acc, key) => {
      acc[key] = input.answers[key];
      return acc;
    }, {});

  let band: EligibilityBand = "READY";
  let pathway = rules.pathway;
  const gaps: string[] = [];
  const risk_notes: string[] = [];

  for (const rule of rules.rules) {
    if (!matchesRule(rule.when, answers)) continue;
    const { effects } = rule;
    if (effects.band_max) {
      band = worseBand(band, effects.band_max, rules.band_priority);
    }
    if (effects.gaps) gaps.push(...effects.gaps);
    if (effects.risk_notes) risk_notes.push(...effects.risk_notes);
    if (effects.pathway_override) pathway = effects.pathway_override;
  }

  const sortedGaps = uniqueSorted(gaps);
  const sortedRisks = uniqueSorted(risk_notes);

  return {
    pathway,
    band,
    gaps: sortedGaps,
    timeline_range: rules.timeline_by_band[band],
    risk_notes: sortedRisks,
    next_step: rules.next_step_by_band[band],
    preparation_path: [...(rules.preparation_path_by_band[band] ?? [])],
    nurture_track: rules.nurture_track_by_band[band] ?? null,
    rules_version: rules.version,
  };
}

export type { DiagnosticResult, DiagnosticRulesConfig, EvaluateInput };
