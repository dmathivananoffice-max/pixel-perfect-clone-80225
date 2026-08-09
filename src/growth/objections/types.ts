/** M7 Objection intelligence (FR-O-01 … FR-O-03). */

export type ObjectionSource =
  | "whatsapp"
  | "counsellor"
  | "diag_exit_survey"
  | "webinar";

export type ObjectionCode =
  | "COST"
  | "TRUST/FRAUD-FEAR"
  | "VISA-RISK"
  | "LANGUAGE-DIFFICULTY"
  | "PARENT-APPROVAL"
  | "RECOGNITION-RISK"
  | "TIMELINE"
  | "COMPETITOR-COMPARISON"
  | "SAFETY-ABROAD"
  | "SELF-DOUBT"
  | "UNCLASSIFIED";

export type ObjectionRecord = {
  id: string;
  lead_id: string | null;
  source: ObjectionSource | string;
  verbatim: string;
  taxonomy_code: ObjectionCode | string | null;
  logged_by: string;
  pathway: string | null;
  session_id: string | null;
  meta: Record<string, unknown>;
  at: string;
};

export type TaxonomyMapping = {
  code: ObjectionCode | string;
  label: string;
  underlying_fear: string;
  evidence_type: string;
  approved_asset_refs: string[];
  talk_track: string;
  active: boolean;
  updated_by: string;
  updated_at: string;
};

export type TrendRow = {
  week_start: string;
  taxonomy_code: string;
  pathway: string;
  objection_count: number;
};

export type LogObjectionInput = {
  lead_id?: string | null;
  source: ObjectionSource | string;
  taxonomy_code: ObjectionCode | string;
  verbatim?: string;
  logged_by: string;
  pathway?: string | null;
  session_id?: string | null;
  meta?: Record<string, unknown>;
};
