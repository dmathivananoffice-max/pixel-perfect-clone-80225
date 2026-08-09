import { FILTER_SAFE_FALLBACK } from "./constants";
import type { FilterResult, FilterRuleClass } from "./types";

/** Regex detectors for FR-W-10 banned phrasing classes (affirmative claims). */
const RULES: { cls: FilterRuleClass; re: RegExp }[] = [
  {
    cls: "visa_probability",
    re: /\b(visa\s+(is\s+)?guaranteed|guaranteed\s+visa|\d+\s*%\s*(chance|probability|success).{0,40}visa|visa.{0,40}(\d+\s*%|guaranteed)|likely\s+get\s+(a\s+)?visa|high\s+chance\s+of\s+(a\s+)?visa|your\s+visa\s+is\s+guaranteed)\b/i,
  },
  {
    cls: "employment_promise",
    re: /\b(guaranteed\s+(employment|job|placement)|you\s+will\s+(get|have|secure)\s+(a\s+)?(job|employment)|we\s+(will\s+)?(get|place|secure)\s+you\s+(a\s+)?job|job\s+is\s+guaranteed)\b/i,
  },
  {
    cls: "guaranteed_salary",
    re: /\b(guaranteed\s+salary|salary\s+is\s+guaranteed|you\s+will\s+(definitely\s+)?(earn|make|get)\s+€?\d|definitely\s+(earn|make|get)\s+(€|eur|inr|rs\.?)|guaranteed\s+salary\s+of)\b/i,
  },
  {
    cls: "certainty_phrasing",
    re: /\b(definitely|guaranteed|absolutely\s+certain|without\s+a\s+doubt)\b|(?<![\d.])100\s*%(?!\d)/i,
  },
];

/** Educational denials — allow these; do not use bare "no" (false positives). */
const SAFE_NEGATION =
  /\b(not|never|cannot|can't|don't|do\s+not|no\s+one\s+can)\s+(guarantee|guaranteed|definitely)|\b(no\s+guarantee|not\s+guaranteed|never\s+guaranteed|cannot\s+guarantee|can't\s+guarantee)\b/i;

export function regexFilter(text: string): FilterRuleClass[] {
  const hits: FilterRuleClass[] = [];
  for (const rule of RULES) {
    if (rule.re.test(text) && !hits.includes(rule.cls)) hits.push(rule.cls);
  }
  if (SAFE_NEGATION.test(text)) {
    return hits.filter(
      (h) => h !== "certainty_phrasing" && h !== "visa_probability",
    );
  }
  return hits;
}

/**
 * Output filter: regex (always) + optional LLM check.
 * Hits → block, caller logs + sends safe fallback + escalates.
 */
export async function filterOutbound(
  text: string,
  llmCheck?: (draft: string) => Promise<FilterRuleClass[]>,
): Promise<FilterResult> {
  const matched = regexFilter(text);
  if (llmCheck) {
    try {
      for (const cls of await llmCheck(text)) {
        if (!matched.includes(cls)) matched.push(cls);
      }
    } catch {
      // LLM check failure must not silence — keep regex result only.
    }
  }
  if (matched.length > 0) {
    return {
      blocked: true,
      matched_rules: matched,
      original_text: text,
      fallback_text: FILTER_SAFE_FALLBACK,
    };
  }
  return { blocked: false, text };
}

/** Hypothetical affirmative a non-compliant bot might say — used to audit bait turns. */
export function baitRiskDraft(inbound: string): string | null {
  if (/\bvisa\b/i.test(inbound) && /guarantee(?:d)?|100\s*%|\bdefinitely\b/i.test(inbound)) {
    return "Yes, your visa is guaranteed with our program.";
  }
  if (
    /\b(salary|earn|pay)\b/i.test(inbound) &&
    /\b(definitely|guaranteed)\b|100\s*%/i.test(inbound)
  ) {
    return "You will definitely get a guaranteed salary of €3500.";
  }
  return null;
}
