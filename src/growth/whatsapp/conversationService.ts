import { applyUsage, budgetHandoffMessage, isBudgetBreached } from "./budget";
import { ESCALATION_AUTO_REPLY, buildFirstMessage } from "./constants";
import { detectEscalation } from "./escalation";
import { baitRiskDraft, filterOutbound } from "./filter";
import type { LlmClient } from "./llm";
import { classifyObjection } from "./objections";
import { draftClosedSkillReply } from "./skills";
import type { WhatsAppStore } from "./store";
import type { InboundInput, TurnResult } from "./types";
import { escalateConversation, finishOutbound } from "./turnFinish";

export type { InboundInput };

export class ConversationService {
  constructor(
    private store: WhatsAppStore,
    private llm: LlmClient,
    private sendText: (
      phone: string,
      text: string,
      template?: string,
    ) => Promise<void>,
  ) {}

  private finish(
    conversationId: string,
    input: InboundInput,
    text: string,
    result: Omit<TurnResult, "outbound_text" | "template_ref"> & {
      template_ref?: string | null;
    },
  ) {
    return finishOutbound(
      this.store,
      this.sendText,
      conversationId,
      input,
      text,
      result,
    );
  }

  async handleInbound(input: InboundInput): Promise<TurnResult> {
    let conv = await this.store.getOrCreateConversation({
      lead_id: input.lead_id,
      wa_phone: input.wa_phone,
      diagnostic_summary: input.diagnostic_summary,
    });

    await this.store.addMessage({
      conversation_id: conv.id,
      direction: "inbound",
      body: input.text,
    });
    conv = await this.store.updateConversation(conv.id, {
      last_inbound_at: new Date().toISOString(),
    });

    if (!conv.first_outbound_sent) {
      return this.finish(conv.id, input, buildFirstMessage(conv.diagnostic_summary ?? ""), {
        skill: "first_message",
        escalated: false,
        meta: { disclosure: true },
      });
    }

    if (conv.agent_state === "escalated") {
      return this.finish(conv.id, input, ESCALATION_AUTO_REPLY, {
        skill: "escalated_idle",
        escalated: true,
        escalation_trigger: "ADVISOR",
        meta: {},
        template_ref: "escalation_ack",
      });
    }

    const budget = await this.store.getTokenBudget();
    if (isBudgetBreached(conv, budget)) {
      await escalateConversation(this.store, conv, "TOKEN_BUDGET", "Token budget breach");
      return this.finish(conv.id, input, budgetHandoffMessage(), {
        skill: "budget_handoff",
        escalated: true,
        escalation_trigger: "TOKEN_BUDGET",
        meta: {},
      });
    }

    await this.logObjectionTurn(conv, input.text);

    const early = detectEscalation({
      text: input.text,
      low_confidence_streak: conv.low_confidence_streak,
    });
    if (early.escalate && early.trigger && early.trigger !== "OUT_OF_CORPUS") {
      await escalateConversation(this.store, conv, early.trigger, early.reason ?? early.trigger);
      return this.finish(conv.id, input, ESCALATION_AUTO_REPLY, {
        skill: "escalate",
        escalated: true,
        escalation_trigger: early.trigger,
        meta: { reason: early.reason },
      });
    }

    const risk = baitRiskDraft(input.text);
    if (risk) {
      return this.runFilterAndSend(conv.id, input, risk, "claim_bait", { claim_bait: true });
    }

    const threshold = await this.store.getFaqThreshold();
    const draft = await draftClosedSkillReply({
      text: input.text,
      store: this.store,
      qualification_state: conv.qualification_state,
      conversation_id: conv.id,
      threshold,
    });

    if (draft.low_confidence || draft.out_of_corpus) {
      const streak = conv.low_confidence_streak + 1;
      conv = await this.store.updateConversation(conv.id, { low_confidence_streak: streak });
      const esc = detectEscalation({
        text: input.text,
        low_confidence_streak: streak,
        out_of_corpus: true,
        outside_skill: draft.outside_skill,
      });
      if (esc.escalate && esc.trigger) {
        await escalateConversation(this.store, conv, esc.trigger, esc.reason ?? esc.trigger);
        return this.finish(conv.id, input, draft.text, {
          skill: draft.skill,
          escalated: true,
          escalation_trigger: esc.trigger,
          meta: { ...draft.meta, streak },
        });
      }
    } else if (draft.skill === "faq") {
      await this.store.updateConversation(conv.id, { low_confidence_streak: 0 });
    }

    if (draft.outside_skill) {
      await escalateConversation(this.store, conv, "OUTSIDE_SKILL_SET", "Outside closed skill set");
      return this.finish(conv.id, input, draft.text, {
        skill: draft.skill,
        escalated: true,
        escalation_trigger: "OUTSIDE_SKILL_SET",
        meta: draft.meta,
      });
    }

    return this.runFilterAndSend(conv.id, input, draft.text, draft.skill, draft.meta);
  }

  private async logObjectionTurn(
    conv: { id: string; lead_id: string; tokens_in_total: number; tokens_out_total: number },
    text: string,
  ) {
    const llmObj = await this.llm.classifyObjection(text);
    await this.store.logLlmUsage({
      module: "M4",
      model: "haiku-class",
      tokens_in: llmObj.tokens_in,
      tokens_out: llmObj.tokens_out,
      cost_eur: 0,
      purpose: "objection_classify",
      conversation_id: conv.id,
      lead_id: conv.lead_id,
    });
    const obj = classifyObjection(text, llmObj.code);
    await this.store.logObjection({
      lead_id: conv.lead_id,
      verbatim: text,
      taxonomy_code: obj.code,
    });
    await this.store.updateConversation(conv.id, applyUsage(conv, llmObj));
  }

  private async runFilterAndSend(
    conversationId: string,
    input: InboundInput,
    draft: string,
    skill: string,
    meta: Record<string, unknown>,
  ): Promise<TurnResult> {
    const conv = (await this.store.getConversation(conversationId))!;
    const filt = await filterOutbound(draft, async (t) => {
      const r = await this.llm.filterCheck(t);
      await this.store.logLlmUsage({
        module: "M4",
        model: "haiku-class",
        tokens_in: r.tokens_in,
        tokens_out: r.tokens_out,
        cost_eur: 0,
        purpose: "output_filter",
        conversation_id: conv.id,
        lead_id: conv.lead_id,
      });
      return r.classes;
    });

    if (filt.blocked) {
      await this.store.logFilterHit({
        conversation_id: conv.id,
        lead_id: conv.lead_id,
        original_text: filt.original_text,
        matched_rules: filt.matched_rules,
        fallback_text: filt.fallback_text,
      });
      await escalateConversation(this.store, conv, "FILTER_HIT", `Filter: ${filt.matched_rules.join(",")}`);
      return this.finish(conv.id, input, filt.fallback_text, {
        skill: "filter_block",
        escalated: true,
        escalation_trigger: "FILTER_HIT",
        filter_hit: filt,
        meta: { ...meta, matched_rules: filt.matched_rules },
      });
    }

    return this.finish(conv.id, input, filt.text, { skill, escalated: false, meta });
  }
}
