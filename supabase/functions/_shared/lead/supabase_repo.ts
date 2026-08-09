import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import type {
  AuditInput,
  InsertLeadInput,
  LeadRepository,
  LeadTouchInput,
  SuppressionInput,
} from "./repo.ts";
import type { LeadRow } from "./types.ts";

const LEAD_COLS =
  "id, phone_e164, name, email, city, language, source_utm, click_ids, first_touch_at, consent, du_flag, referrer_lead_id, platform_candidate_id, diagnostic_session_id, erased_at";

export function createSupabaseLeadRepo(
  client: SupabaseClient,
): LeadRepository {
  return {
    async findByPhone(phoneE164) {
      const { data, error } = await client
        .schema("growth")
        .from("lead")
        .select(LEAD_COLS)
        .eq("phone_e164", phoneE164)
        .maybeSingle();
      if (error) throw error;
      return (data as LeadRow | null) ?? null;
    },

    async findById(id) {
      const { data, error } = await client
        .schema("growth")
        .from("lead")
        .select(LEAD_COLS)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as LeadRow | null) ?? null;
    },

    async insertLead(input: InsertLeadInput) {
      const { data, error } = await client
        .schema("growth")
        .from("lead")
        .insert(input)
        .select(LEAD_COLS)
        .single();
      if (error) throw error;
      return data as LeadRow;
    },

    async updateLead(id, fields) {
      const { data, error } = await client
        .schema("growth")
        .from("lead")
        .update(fields)
        .eq("id", id)
        .select(LEAD_COLS)
        .single();
      if (error) throw error;
      return data as LeadRow;
    },

    async insertTouch(input: LeadTouchInput) {
      const { error } = await client.schema("growth").from("lead_touch").insert(input);
      if (error) throw error;
    },

    async insertFunnelEvent(input) {
      const { error } = await client.schema("growth").from("funnel_event").insert({
        lead_id: input.lead_id,
        session_id: input.session_id,
        type: input.type,
        stage: input.stage,
        meta: input.meta ?? {},
        at: input.at,
      });
      if (error) throw error;
    },

    async anonymiseLead(id, fields) {
      const { error } = await client
        .schema("growth")
        .from("lead")
        .update(fields)
        .eq("id", id);
      if (error) throw error;
    },

    async clearMessageBodies(leadId) {
      const { data: convos, error: cErr } = await client
        .schema("growth")
        .from("conversation")
        .select("id")
        .eq("lead_id", leadId);
      if (cErr) throw cErr;
      const ids = (convos ?? []).map((c: { id: string }) => c.id);
      if (ids.length === 0) return 0;
      const { data, error } = await client
        .schema("growth")
        .from("message")
        .update({ body: "[erased]" })
        .in("conversation_id", ids)
        .neq("body", "[erased]")
        .select("id");
      if (error) throw error;
      return (data ?? []).length;
    },

    async upsertSuppression(input: SuppressionInput) {
      const { error } = await client
        .schema("growth")
        .from("suppression")
        .upsert(input, { onConflict: "channel,value_hash" });
      if (error) throw error;
    },

    async isSuppressed(valueType, valueHash) {
      const { data, error } = await client
        .schema("growth")
        .from("suppression")
        .select("id")
        .eq("value_type", valueType)
        .eq("value_hash", valueHash)
        .limit(1);
      if (error) throw error;
      return (data ?? []).length > 0;
    },

    async insertAudit(input: AuditInput) {
      const { error } = await client.schema("growth").from("audit").insert({
        actor: input.actor,
        action: input.action,
        entity: input.entity,
        before_hash: input.before_hash ?? null,
        after_hash: input.after_hash ?? null,
        gate_results: input.gate_results ?? {},
      });
      if (error) throw error;
    },
  };
}
