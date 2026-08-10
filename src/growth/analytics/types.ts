/** M8 analytics + M15 dashboard (FR-A / FR-DB). */

export type FunnelStage =
  | "session"
  | "diagnostic"
  | "lead"
  | "score"
  | "booking"
  | "attended"
  | "application"
  | "paid";

export type FunnelEventType =
  | "DIAG_START"
  | "DIAG_QUESTION_ANSWERED"
  | "DIAG_COMPLETE"
  | "DIAG_ABANDONED"
  | "DIAG_CONTACT_CAPTURED"
  | "LEAD_CREATED"
  | "LEAD_RETURNED"
  | "BAND_ASSIGNED"
  | "BAND_CHANGED"
  | "BOOKING_CREATED"
  | "COUNSELLING_ATTENDED"
  | "APPLICATION_SUBMITTED"
  | "PAID";

export type FunnelEvent = {
  id: string;
  lead_id: string | null;
  session_id: string | null;
  type: FunnelEventType | string;
  stage: FunnelStage | string;
  meta: Record<string, unknown>;
  at: string;
};

export type DailyRollupRow = {
  day: string;
  stage: string;
  event_type: string;
  pathway: string;
  source: string;
  event_count: number;
  cost_eur: number;
};

export type DropoffRow = {
  day: string;
  pathway: string;
  question_id: string;
  question_index: number;
  answered_count: number;
};

export type LlmRollupRow = {
  day: string;
  module: string;
  tokens_in: number;
  tokens_out: number;
  cost_eur: number;
};

export type DashboardRole =
  | "counsellor"
  | "compliance_reviewer"
  | "marketing_operator"
  | "admin";

export type HotQueueItem = {
  lead_id: string;
  name: string | null;
  band: "HOT";
  scored_at: string;
  sla_deadline: string;
  hours_remaining: number;
  breached: boolean;
};

export type HomeMetrics = {
  today: { leads: number; mqls: number; bookings: number; spend_placeholder: number };
  yesterday: { leads: number; mqls: number; bookings: number; spend_placeholder: number };
  alerts: { severity: string; title: string; body: string; href?: string }[];
  llm_today_eur: number;
  llm_month_eur: number;
  envelope_eur: number;
};

export type FunnelStageMetric = {
  stage: FunnelStage;
  label: string;
  count: number;
  conversion_from_prev: number | null;
  glossary_key: string;
};
