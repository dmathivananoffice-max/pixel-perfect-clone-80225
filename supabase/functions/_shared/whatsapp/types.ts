/** M4 WhatsApp qualification agent (FR-W-01 … FR-W-10). */

export type AgentState = "active" | "escalated" | "closed";

export type EscalationTrigger =
  | "ADVISOR"
  | "COMPLAINT"
  | "OUT_OF_CORPUS"
  | "PAYMENT_REFUND"
  | "PERSONAL_LEGAL_VISA"
  | "LOW_CONFIDENCE_STREAK"
  | "TOKEN_BUDGET"
  | "FILTER_HIT"
  | "OUTSIDE_SKILL_SET";

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

export type FilterRuleClass =
  | "visa_probability"
  | "employment_promise"
  | "guaranteed_salary"
  | "certainty_phrasing";

export type ConversationRecord = {
  id: string;
  lead_id: string;
  channel: string;
  wa_phone: string | null;
  opened_at: string;
  closed_at: string | null;
  handled_by: string;
  last_inbound_at: string | null;
  tokens_in_total: number;
  tokens_out_total: number;
  low_confidence_streak: number;
  agent_state: AgentState;
  qualification_state: Record<string, unknown>;
  opt_in_at: string | null;
  first_outbound_sent: boolean;
  diagnostic_summary: string | null;
};

export type MessageRecord = {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  body: string;
  template_ref: string | null;
  agent_meta: Record<string, unknown> | null;
  at: string;
};

export type FaqAsset = {
  id: string;
  status: string;
  type: string;
  title: string;
  version: number;
  question_patterns: string[];
  answer_text: string;
  body_ref: string;
};

export type TokenBudget = {
  max_tokens_in: number;
  max_tokens_out: number;
  max_total: number;
};

export type LlmUsageEvent = {
  module: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_eur: number;
  purpose: string;
  conversation_id?: string;
  lead_id?: string;
};

export type FilterHit = {
  blocked: true;
  matched_rules: FilterRuleClass[];
  original_text: string;
  fallback_text: string;
};

export type FilterOk = { blocked: false; text: string };

export type FilterResult = FilterHit | FilterOk;

export type TurnResult = {
  outbound_text: string;
  template_ref: string | null;
  escalated: boolean;
  escalation_trigger?: EscalationTrigger;
  filter_hit?: FilterHit;
  skill: string;
  meta: Record<string, unknown>;
};
