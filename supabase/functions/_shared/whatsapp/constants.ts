import type { ObjectionCode, TokenBudget } from "./types";

export const AUTOMATION_DISCLOSURE =
  "You're chatting with Workforce Europe's automated assistant. A human advisor is available anytime — reply ADVISOR.";

export const LOW_CONFIDENCE_REPLY =
  "Good question — I'll have an advisor confirm this for you.";

export const ESCALATION_AUTO_REPLY =
  "Thanks — I've notified a human advisor who will follow up with you. Reply ADVISOR anytime if you need anything else.";

export const BUDGET_HANDOFF_REPLY =
  "I want to make sure you get accurate help from a person now. A human advisor will take it from here — they'll be in touch shortly.";

export const FILTER_SAFE_FALLBACK =
  "I can't make promises about visas, salaries, jobs, or guaranteed outcomes. A human advisor can explain what's realistic for your situation — reply ADVISOR.";

export const OUTSIDE_WINDOW_HINT =
  "Our chat window has closed. Please use an approved template message or reply ADVISOR and an advisor will reach out.";

export const DEFAULT_TOKEN_BUDGET: TokenBudget = {
  max_tokens_in: 8000,
  max_tokens_out: 4000,
  max_total: 10000,
};

export const DEFAULT_FAQ_THRESHOLD = 0.42;

export const OBJECTION_TAXONOMY: ObjectionCode[] = [
  "COST",
  "TRUST/FRAUD-FEAR",
  "VISA-RISK",
  "LANGUAGE-DIFFICULTY",
  "PARENT-APPROVAL",
  "RECOGNITION-RISK",
  "TIMELINE",
  "COMPETITOR-COMPARISON",
  "SAFETY-ABROAD",
  "SELF-DOUBT",
  "UNCLASSIFIED",
];

export const QUALIFICATION_QUESTIONS = [
  {
    id: "german_level",
    prompt: "What is your current German level (A1–C1, or not started)?",
  },
  {
    id: "timeline",
    prompt: "When are you hoping to start your pathway (months)?",
  },
  {
    id: "qualification",
    prompt: "Do you already hold a nursing qualification, or are you exploring Ausbildung?",
  },
];

export function buildFirstMessage(diagnosticSummary: string): string {
  const summary =
    diagnosticSummary.trim() ||
    "Thanks for completing your Pathway Diagnostic — we've saved your result summary.";
  return `${summary}\n\n${AUTOMATION_DISCLOSURE}`;
}
