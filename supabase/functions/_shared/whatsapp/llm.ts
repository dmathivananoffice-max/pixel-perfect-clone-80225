import type { FilterRuleClass, LlmUsageEvent, ObjectionCode } from "./types";

export type LlmClient = {
  classifyObjection(text: string): Promise<{
    code: ObjectionCode;
    tokens_in: number;
    tokens_out: number;
  }>;
  filterCheck(text: string): Promise<{
    classes: FilterRuleClass[];
    tokens_in: number;
    tokens_out: number;
  }>;
  /** Optional freeform assist — never used for visa/salary claims. */
  draftSkillReply?(prompt: string): Promise<{
    text: string;
    tokens_in: number;
    tokens_out: number;
  }>;
};

const HAIKU = "claude-haiku-4-5-20251001";

/** Deterministic stub for tests / offline. */
export function createStubLlm(): LlmClient {
  return {
    async classifyObjection() {
      return { code: "UNCLASSIFIED", tokens_in: 20, tokens_out: 5 };
    },
    async filterCheck(text: string) {
      const classes: FilterRuleClass[] = [];
      if (/definitely|guaranteed|100%/i.test(text)) {
        classes.push("certainty_phrasing");
      }
      return { classes, tokens_in: 30, tokens_out: 8 };
    },
  };
}

/**
 * Anthropic haiku-class client. Requires ANTHROPIC_API_KEY.
 * Falls back to stub behavior when key missing.
 */
export function createAnthropicLlm(
  fetchImpl: typeof fetch = fetch,
  onUsage?: (u: LlmUsageEvent) => void | Promise<void>,
): LlmClient {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return createStubLlm();

  async function complete(system: string, user: string, purpose: string) {
    const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: HAIKU,
        max_tokens: 256,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = data.content?.find((c) => c.type === "text")?.text ?? "";
    const tokens_in = data.usage?.input_tokens ?? 0;
    const tokens_out = data.usage?.output_tokens ?? 0;
    await onUsage?.({
      module: "M4",
      model: HAIKU,
      tokens_in,
      tokens_out,
      cost_eur: (tokens_in + tokens_out) * 0.0000003,
      purpose,
    });
    return { text, tokens_in, tokens_out };
  }

  return {
    async classifyObjection(text: string) {
      const r = await complete(
        "Classify the message into one objection code. Reply with only the code.",
        `Codes: COST, TRUST/FRAUD-FEAR, VISA-RISK, LANGUAGE-DIFFICULTY, PARENT-APPROVAL, RECOGNITION-RISK, TIMELINE, COMPETITOR-COMPARISON, SAFETY-ABROAD, SELF-DOUBT, UNCLASSIFIED\nMessage: ${text}`,
        "objection_classify",
      );
      const code = r.text.trim().split(/\s+/)[0] as ObjectionCode;
      return { code, tokens_in: r.tokens_in, tokens_out: r.tokens_out };
    },
    async filterCheck(text: string) {
      const r = await complete(
        'Return JSON {"classes":[]} with any of: visa_probability, employment_promise, guaranteed_salary, certainty_phrasing',
        text,
        "output_filter",
      );
      try {
        const parsed = JSON.parse(r.text) as { classes?: FilterRuleClass[] };
        return {
          classes: parsed.classes ?? [],
          tokens_in: r.tokens_in,
          tokens_out: r.tokens_out,
        };
      } catch {
        return { classes: [], tokens_in: r.tokens_in, tokens_out: r.tokens_out };
      }
    },
  };
}
