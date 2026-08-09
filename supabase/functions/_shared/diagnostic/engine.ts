/** Deno copy of src/growth/diagnostic/engine.ts — keep in sync (FR-D-06). */

export type EligibilityBand = "READY" | "PREPARABLE" | "NOT_YET";

export type DiagnosticResult = {
  pathway: string;
  band: EligibilityBand;
  gaps: string[];
  timeline_range: { min_months: number; max_months: number };
  risk_notes: string[];
  next_step: string;
  preparation_path: string[];
  nurture_track: string | null;
  rules_version: string;
};

export type DiagnosticRulesConfig = {
  version: string;
  branch: string;
  pathway: string;
  rules: Array<{
    id: string;
    when: {
      answer_key: string;
      equals?: string;
      in?: string[];
      not_in?: string[];
    };
    effects: {
      band_max?: EligibilityBand;
      gaps?: string[];
      risk_notes?: string[];
      pathway_override?: string;
    };
  }>;
  band_priority: EligibilityBand[];
  timeline_by_band: Record<
    EligibilityBand,
    { min_months: number; max_months: number }
  >;
  next_step_by_band: Record<EligibilityBand, string>;
  preparation_path_by_band: Record<EligibilityBand, string[]>;
  nurture_track_by_band: Record<EligibilityBand, string | null>;
};

function matches(
  when: DiagnosticRulesConfig["rules"][0]["when"],
  answers: Record<string, string>,
): boolean {
  const value = answers[when.answer_key];
  if (value == null) return false;
  if (when.equals != null) return value === when.equals;
  if (when.in != null) return when.in.includes(value);
  if (when.not_in != null) return !when.not_in.includes(value);
  return false;
}

function worse(
  current: EligibilityBand,
  candidate: EligibilityBand,
  priority: EligibilityBand[],
): EligibilityBand {
  const ci = priority.indexOf(current);
  const ni = priority.indexOf(candidate);
  if (ni === -1) return current;
  if (ci === -1) return candidate;
  return ni < ci ? candidate : current;
}

export function evaluateDiagnostic(input: {
  branch: string;
  answers: Record<string, string>;
  rules: DiagnosticRulesConfig;
}): DiagnosticResult {
  const { branch, rules } = input;
  if (rules.branch !== branch) {
    throw new Error(`rules.branch mismatch: ${rules.branch} vs ${branch}`);
  }
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
  const sortedRules = [...rules.rules].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );

  for (const rule of sortedRules) {
    if (!matches(rule.when, answers)) continue;
    if (rule.effects.band_max) {
      band = worse(band, rule.effects.band_max, rules.band_priority);
    }
    if (rule.effects.gaps) gaps.push(...rule.effects.gaps);
    if (rule.effects.risk_notes) risk_notes.push(...rule.effects.risk_notes);
    if (rule.effects.pathway_override) pathway = rule.effects.pathway_override;
  }

  const uniq = (items: string[]) =>
    [...new Set(items)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  return {
    pathway,
    band,
    gaps: uniq(gaps),
    timeline_range: rules.timeline_by_band[band],
    risk_notes: uniq(risk_notes),
    next_step: rules.next_step_by_band[band],
    preparation_path: [...(rules.preparation_path_by_band[band] ?? [])],
    nurture_track: rules.nurture_track_by_band[band] ?? null,
    rules_version: rules.version,
  };
}
