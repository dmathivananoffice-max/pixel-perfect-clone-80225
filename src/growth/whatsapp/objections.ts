import { OBJECTION_TAXONOMY } from "./constants";
import type { ObjectionCode } from "./types";

const HEURISTICS: { code: ObjectionCode; re: RegExp }[] = [
  { code: "COST", re: /\b(cost|expensive|fee|afford|price|money|budget)\b/i },
  {
    code: "TRUST/FRAUD-FEAR",
    re: /\b(scam|fraud|trust|fake|cheat)\b/i,
  },
  { code: "VISA-RISK", re: /\b(visa|reject|refusal|immigration)\b/i },
  {
    code: "LANGUAGE-DIFFICULTY",
    re: /\b(german|language|a1|a2|b1|b2| entlich)\b/i,
  },
  {
    code: "PARENT-APPROVAL",
    re: /\b(parent|family|mom|dad|mother|father)\b/i,
  },
  {
    code: "RECOGNITION-RISK",
    re: /\b(recognition|anerkennung|qualify|qualification)\b/i,
  },
  { code: "TIMELINE", re: /\b(how long|timeline|when|months|delay)\b/i },
  {
    code: "COMPETITOR-COMPARISON",
    re: /\b(other\s+agency|competitor|cheaper\s+than)\b/i,
  },
  { code: "SAFETY-ABROAD", re: /\b(safe|safety|alone|danger)\b/i },
  {
    code: "SELF-DOUBT",
    re: /\b(not\s+sure|can'?t\s+do|doubt|afraid\s+i)\b/i,
  },
];

/**
 * FR-W-04 / FR-O-02: classify inbound against taxonomy.
 * Low confidence → UNCLASSIFIED (still logged for clustering).
 */
export function classifyObjection(
  text: string,
  llmCode?: ObjectionCode | null,
): { code: ObjectionCode; confidence: number } {
  if (llmCode && OBJECTION_TAXONOMY.includes(llmCode)) {
    return { code: llmCode, confidence: 0.7 };
  }
  for (const h of HEURISTICS) {
    if (h.re.test(text)) return { code: h.code, confidence: 0.55 };
  }
  return { code: "UNCLASSIFIED", confidence: 0.2 };
}
