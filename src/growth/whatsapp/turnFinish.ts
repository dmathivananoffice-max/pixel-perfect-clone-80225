import { isInsideSessionWindow } from "./sessionWindow";
import type { WhatsAppStore } from "./store";
import type { EscalationTrigger, InboundInput, TurnResult } from "./types";

export async function escalateConversation(
  store: WhatsAppStore,
  conv: { id: string; lead_id: string },
  trigger: EscalationTrigger,
  reason: string,
) {
  await store.enqueueCounsellor({
    lead_id: conv.lead_id,
    conversation_id: conv.id,
    reason,
    trigger_code: trigger,
  });
  await store.updateConversation(conv.id, {
    agent_state: "escalated",
    handled_by: "counsellor_queue",
  });
}

export async function finishOutbound(
  store: WhatsAppStore,
  sendText: (phone: string, text: string, template?: string) => Promise<void>,
  conversationId: string,
  input: InboundInput,
  text: string,
  result: Omit<TurnResult, "outbound_text" | "template_ref"> & {
    template_ref?: string | null;
  },
): Promise<TurnResult> {
  const conv = await store.getConversation(conversationId);
  if (!conv) throw new Error("conversation missing");

  const inside = isInsideSessionWindow(conv.last_inbound_at);
  let template_ref = result.template_ref ?? null;
  let body = text;
  if (!inside) {
    const tpl = await store.getTemplate(template_ref ?? "session_reopen");
    body = tpl?.body ?? text;
    template_ref = tpl?.name ?? "session_reopen";
  }

  await store.addMessage({
    conversation_id: conversationId,
    direction: "outbound",
    body,
    template_ref,
    agent_meta: { skill: result.skill, ...result.meta },
  });
  await store.updateConversation(conversationId, { first_outbound_sent: true });

  if (!input.dry_run) {
    await sendText(input.wa_phone, body, template_ref ?? undefined);
  }

  return {
    outbound_text: body,
    template_ref,
    escalated: result.escalated,
    escalation_trigger: result.escalation_trigger,
    filter_hit: result.filter_hit,
    skill: result.skill,
    meta: result.meta,
  };
}
