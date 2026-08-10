/**
 * Edge conversation loop — mirrors src/growth/whatsapp/ConversationService
 * using Supabase growth schema.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { budgetHandoffMessage, isBudgetBreached } from "./budget.ts";
import {
  AUTOMATION_DISCLOSURE,
  DEFAULT_FAQ_THRESHOLD,
  DEFAULT_TOKEN_BUDGET,
  ESCALATION_AUTO_REPLY,
  LOW_CONFIDENCE_REPLY,
  buildFirstMessage,
} from "./constants.ts";
import { detectEscalation } from "./escalation.ts";
import { baitRiskDraft, filterOutbound } from "./filter.ts";
import { cosineSimilarity, embedText } from "./embed.ts";
import { classifyObjection } from "./objections.ts";
import { isInsideSessionWindow } from "./sessionWindow.ts";
import { resolveApprovedAsset } from "./approvedResolve.ts";
import { metaSendText, metaSendTemplate } from "./metaSend.ts";

type Conv = {
  id: string;
  lead_id: string;
  wa_phone: string | null;
  first_outbound_sent: boolean;
  agent_state: string;
  tokens_in_total: number;
  tokens_out_total: number;
  low_confidence_streak: number;
  last_inbound_at: string | null;
  diagnostic_summary: string | null;
  qualification_state: Record<string, unknown>;
};

export async function handleEdgeInbound(
  client: SupabaseClient,
  input: { from: string; text: string },
) {
  const phone = input.from;
  const lead = await ensureLead(client, phone);
  let conv = await ensureConversation(client, lead.id, phone);

  await client.from("message").insert({
    conversation_id: conv.id,
    direction: "inbound",
    body: input.text,
  });
  await client
    .from("conversation")
    .update({ last_inbound_at: new Date().toISOString() })
    .eq("id", conv.id);
  conv = { ...conv, last_inbound_at: new Date().toISOString() };

  if (!conv.first_outbound_sent) {
    const body = buildFirstMessage(conv.diagnostic_summary ?? "");
    await sendAndLog(client, conv, phone, body, "first_message");
    return { skill: "first_message", body };
  }

  if (conv.agent_state === "escalated") {
    await sendAndLog(client, conv, phone, ESCALATION_AUTO_REPLY, "escalated_idle", "escalation_ack");
    return { skill: "escalated_idle", body: ESCALATION_AUTO_REPLY };
  }

  if (isBudgetBreached(conv, DEFAULT_TOKEN_BUDGET)) {
    await escalate(client, conv, "TOKEN_BUDGET", "budget");
    const body = budgetHandoffMessage();
    await sendAndLog(client, conv, phone, body, "budget_handoff");
    return { skill: "budget_handoff", body };
  }

  const obj = classifyObjection(input.text);
  await client.from("objection").insert({
    lead_id: conv.lead_id,
    source: "whatsapp",
    verbatim: input.text,
    taxonomy_code: obj.code,
    logged_by: "whatsapp_agent",
  });
  await client.from("llm_usage").insert({
    module: "M4",
    model: "haiku-class",
    tokens_in: 20,
    tokens_out: 5,
    cost_eur: 0,
    purpose: "objection_classify",
    conversation_id: conv.id,
    lead_id: conv.lead_id,
  });

  const early = detectEscalation({
    text: input.text,
    low_confidence_streak: conv.low_confidence_streak,
  });
  if (early.escalate && early.trigger && early.trigger !== "OUT_OF_CORPUS") {
    await escalate(client, conv, early.trigger, early.reason ?? "");
    await sendAndLog(client, conv, phone, ESCALATION_AUTO_REPLY, "escalate");
    return { skill: "escalate", body: ESCALATION_AUTO_REPLY, trigger: early.trigger };
  }

  const risk = baitRiskDraft(input.text);
  let draft = risk ?? (await faqOrFallback(client, input.text));
  if (!risk && draft === LOW_CONFIDENCE_REPLY) {
    const streak = conv.low_confidence_streak + 1;
    await client.from("conversation").update({ low_confidence_streak: streak }).eq("id", conv.id);
    await escalate(client, conv, streak >= 3 ? "LOW_CONFIDENCE_STREAK" : "OUT_OF_CORPUS", "faq miss");
    await sendAndLog(client, conv, phone, draft, "faq_low_confidence");
    return { skill: "faq_low_confidence", body: draft };
  }

  const filt = await filterOutbound(draft);
  if (filt.blocked) {
    await client.from("filter_log").insert({
      conversation_id: conv.id,
      lead_id: conv.lead_id,
      direction: "draft",
      original_text: filt.original_text,
      matched_rules: filt.matched_rules,
      action: "blocked",
      fallback_text: filt.fallback_text,
    });
    await escalate(client, conv, "FILTER_HIT", filt.matched_rules.join(","));
    await sendAndLog(client, conv, phone, filt.fallback_text, "filter_block");
    return {
      skill: "filter_block",
      body: filt.fallback_text,
      filter: filt.matched_rules,
    };
  }

  void AUTOMATION_DISCLOSURE;
  await sendAndLog(client, conv, phone, filt.text, risk ? "claim_bait" : "faq");
  return { skill: risk ? "filter_block" : "faq", body: filt.text };
}

async function faqOrFallback(client: SupabaseClient, text: string) {
  const { data } = await client
    .from("asset")
    .select("id,status,type,title,version,body_ref,question_patterns,answer_text,body,version_hash")
    .eq("type", "FAQ_ANSWER")
    .eq("status", "APPROVED");
  const q = embedText(text);
  let best: { row: Record<string, unknown>; score: number } | null = null;
  for (const row of data ?? []) {
    const patterns = (row.question_patterns as string[]) ?? [];
    let score = 0;
    for (const p of patterns) score = Math.max(score, cosineSimilarity(q, embedText(p)));
    if (!best || score > best.score) best = { row, score };
  }
  if (!best || best.score < DEFAULT_FAQ_THRESHOLD) return LOW_CONFIDENCE_REPLY;
  const resolved = resolveApprovedAsset(best.row as never);
  return (resolved.answer_text as string) || LOW_CONFIDENCE_REPLY;
}

async function ensureLead(client: SupabaseClient, phone: string) {
  const { data: existing } = await client
    .from("lead")
    .select("id")
    .eq("phone_e164", phone)
    .maybeSingle();
  if (existing) return existing;
  const { data, error } = await client
    .from("lead")
    .insert({
      phone_e164: phone,
      consent: { whatsapp: true },
      language: "en",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

async function ensureConversation(
  client: SupabaseClient,
  leadId: string,
  phone: string,
): Promise<Conv> {
  const { data: existing } = await client
    .from("conversation")
    .select("*")
    .eq("wa_phone", phone)
    .is("closed_at", null)
    .maybeSingle();
  if (existing) return existing as Conv;
  const { data, error } = await client
    .from("conversation")
    .insert({
      lead_id: leadId,
      channel: "whatsapp",
      wa_phone: phone,
      handled_by: "agent",
      opt_in_at: new Date().toISOString(),
      diagnostic_summary:
        "Your Pathway Diagnostic result is ready. We'll use it to guide next steps.",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Conv;
}

async function escalate(
  client: SupabaseClient,
  conv: Conv,
  trigger: string,
  reason: string,
) {
  await client.from("counsellor_queue").insert({
    lead_id: conv.lead_id,
    conversation_id: conv.id,
    reason,
    trigger_code: trigger,
    priority: "high",
  });
  await client
    .from("conversation")
    .update({ agent_state: "escalated", handled_by: "counsellor_queue" })
    .eq("id", conv.id);
}

async function sendAndLog(
  client: SupabaseClient,
  conv: Conv,
  phone: string,
  body: string,
  skill: string,
  templateName?: string,
) {
  const inside = isInsideSessionWindow(conv.last_inbound_at);
  let text = body;
  let template_ref: string | null = null;
  const token = Deno.env.get("WHATSAPP_TOKEN") ?? Deno.env.get("META_WA_TOKEN");
  const phoneNumberId =
    Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ??
    Deno.env.get("META_WA_PHONE_NUMBER_ID");

  if (!inside) {
    const { data: tpl } = await client
      .from("wa_template")
      .select("*")
      .eq("name", templateName ?? "session_reopen")
      .eq("status", "ACTIVE")
      .maybeSingle();
    text = tpl?.body ?? body;
    template_ref = tpl?.name ?? "session_reopen";
    if (token && phoneNumberId && tpl) {
      await metaSendTemplate({
        token,
        phoneNumberId,
        to: phone,
        templateName: tpl.meta_template_name,
      });
    }
  } else if (token && phoneNumberId) {
    await metaSendText({ token, phoneNumberId, to: phone, text });
  }

  await client.from("message").insert({
    conversation_id: conv.id,
    direction: "outbound",
    body: text,
    template_ref,
    agent_meta: { skill },
  });
  await client
    .from("conversation")
    .update({ first_outbound_sent: true })
    .eq("id", conv.id);
}
