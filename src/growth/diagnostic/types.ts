/** Pathway Diagnostic rules engine types (FR-D-05, FR-D-06, FR-D-09). */

export type EligibilityBand = "READY" | "PREPARABLE" | "NOT_YET";

export type TimelineRange = {
  min_months: number;
  max_months: number;
};

export type DiagnosticResult = {
  pathway: string;
  band: EligibilityBand;
  gaps: string[];
  timeline_range: TimelineRange;
  risk_notes: string[];
  next_step: string;
  /** Concrete prep steps when NOT_YET / PREPARABLE (FR-D-09). */
  preparation_path: string[];
  /** Distinct nurture track key for NOT_YET (FR-D-09). */
  nurture_track: string | null;
  rules_version: string;
};

export type RuleWhen = {
  answer_key: string;
  equals?: string;
  in?: string[];
  not_in?: string[];
};

export type RuleEffects = {
  /** Worst-case cap for band (engine keeps the more restrictive). */
  band_max?: EligibilityBand;
  gaps?: string[];
  risk_notes?: string[];
  pathway_override?: string;
};

export type DiagnosticRule = {
  id: string;
  when: RuleWhen;
  effects: RuleEffects;
};

export type DiagnosticRulesConfig = {
  version: string;
  branch: string;
  pathway: string;
  rules: DiagnosticRule[];
  band_priority: EligibilityBand[];
  timeline_by_band: Record<EligibilityBand, TimelineRange>;
  next_step_by_band: Record<EligibilityBand, string>;
  preparation_path_by_band: Record<EligibilityBand, string[]>;
  nurture_track_by_band: Record<EligibilityBand, string | null>;
};

export type EvaluateInput = {
  branch: string;
  answers: Record<string, string>;
  rules: DiagnosticRulesConfig;
};
