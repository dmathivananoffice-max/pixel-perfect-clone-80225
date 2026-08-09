import type { EscalationTrigger } from "./types";

const ADVISOR_RE = /\bADVISOR\b/i;
const PAYMENT_RE =
  /\b(refund|payment|pay\s*now|charge(d|s)?|upi|invoice|money\s+back)\b/i;
const PERSONAL_LEGAL_RE =
  /\b(my\s+visa\s+(case|application|refusal|rejection)|lawyer|attorney|appeal\s+my|legal\s+advice\s+for\s+me|my\s+case\s+number)\b/i;
const COMPLAINT_RE =
  /\b(complaint|fraud|scam|cheat(ed|ing)?|worst\s+service|refund\s+me|this\s+is\s+illegal|lawsuit)\b/i;

export type EscalationCheck = {
  escalate: boolean;
  trigger?: EscalationTrigger;
  reason?: string;
};

/** FR-W-05 escalation triggers on inbound text + conversation counters. */
export function detectEscalation(input: {
  text: string;
  low_confidence_streak: number;
  out_of_corpus?: boolean;
  filter_hit?: boolean;
  budget_breach?: boolean;
  outside_skill?: boolean;
}): EscalationCheck {
  if (input.budget_breach) {
    return {
      escalate: true,
      trigger: "TOKEN_BUDGET",
      reason: "Per-conversation LLM budget exceeded",
    };
  }
  if (input.filter_hit) {
    return {
      escalate: true,
      trigger: "FILTER_HIT",
      reason: "Outbound filter blocked banned phrasing",
    };
  }
  if (ADVISOR_RE.test(input.text)) {
    return {
      escalate: true,
      trigger: "ADVISOR",
      reason: "User requested human advisor",
    };
  }
  if (COMPLAINT_RE.test(input.text)) {
    return {
      escalate: true,
      trigger: "COMPLAINT",
      reason: "Complaint / fraud-fear sentiment",
    };
  }
  if (PAYMENT_RE.test(input.text)) {
    return {
      escalate: true,
      trigger: "PAYMENT_REFUND",
      reason: "Payment or refund mention",
    };
  }
  if (PERSONAL_LEGAL_RE.test(input.text)) {
    return {
      escalate: true,
      trigger: "PERSONAL_LEGAL_VISA",
      reason: "Personal legal/visa case question",
    };
  }
  if (input.out_of_corpus) {
    return {
      escalate: true,
      trigger: "OUT_OF_CORPUS",
      reason: "Question below FAQ retrieval threshold",
    };
  }
  if (input.low_confidence_streak >= 3) {
    return {
      escalate: true,
      trigger: "LOW_CONFIDENCE_STREAK",
      reason: "3 consecutive low-confidence turns",
    };
  }
  if (input.outside_skill) {
    return {
      escalate: true,
      trigger: "OUTSIDE_SKILL_SET",
      reason: "Request outside closed skill set",
    };
  }
  return { escalate: false };
}
