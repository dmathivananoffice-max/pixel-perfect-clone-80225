import { BUDGET_HANDOFF_REPLY, DEFAULT_TOKEN_BUDGET } from "./constants";
import type { TokenBudget } from "./types";

export function isBudgetBreached(
  used: { tokens_in_total: number; tokens_out_total: number },
  budget: TokenBudget = DEFAULT_TOKEN_BUDGET,
): boolean {
  const total = used.tokens_in_total + used.tokens_out_total;
  return (
    used.tokens_in_total >= budget.max_tokens_in ||
    used.tokens_out_total >= budget.max_tokens_out ||
    total >= budget.max_total
  );
}

export function budgetHandoffMessage(): string {
  return BUDGET_HANDOFF_REPLY;
}

export function applyUsage(
  used: { tokens_in_total: number; tokens_out_total: number },
  delta: { tokens_in: number; tokens_out: number },
) {
  return {
    tokens_in_total: used.tokens_in_total + delta.tokens_in,
    tokens_out_total: used.tokens_out_total + delta.tokens_out,
  };
}
