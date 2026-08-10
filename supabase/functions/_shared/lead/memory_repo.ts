import type {
  AuditInput,
  InsertLeadInput,
  LeadRepository,
  LeadTouchInput,
  SuppressionInput,
} from "./repo.ts";
import type { FunnelEventType, LeadRow } from "./types.ts";

type Message = {
  id: string;
  conversation_id: string;
  body: string;
};

type Conversation = { id: string; lead_id: string };

/** In-memory LeadRepository for unit tests. */
export class MemoryLeadRepo implements LeadRepository {
  leads = new Map<string, LeadRow>();
  touches: LeadTouchInput[] = [];
  funnel: Array<{
    lead_id: string;
    type: FunnelEventType;
    stage: string;
    meta?: Record<string, unknown>;
  }> = [];
  suppressions: SuppressionInput[] = [];
  audits: AuditInput[] = [];
  conversations: Conversation[] = [];
  messages: Message[] = [];

  async findByPhone(phoneE164: string) {
    for (const lead of this.leads.values()) {
      if (lead.phone_e164 === phoneE164) return structuredClone(lead);
    }
    return null;
  }

  async findById(id: string) {
    const lead = this.leads.get(id);
    return lead ? structuredClone(lead) : null;
  }

  async insertLead(input: InsertLeadInput) {
    const row: LeadRow = {
      id: crypto.randomUUID(),
      phone_e164: input.phone_e164,
      name: input.name,
      email: input.email,
      city: input.city,
      language: input.language,
      source_utm: input.source_utm,
      click_ids: input.click_ids,
      first_touch_at: input.first_touch_at,
      consent: input.consent,
      du_flag: false,
      referrer_lead_id: null,
      platform_candidate_id: input.platform_candidate_id,
      diagnostic_session_id: input.diagnostic_session_id,
      erased_at: null,
    };
    this.leads.set(row.id, row);
    return structuredClone(row);
  }

  async updateLead(id: string, fields: Partial<LeadRow>) {
    const cur = this.leads.get(id);
    if (!cur) throw new Error("lead not found");
    const next = { ...cur, ...fields };
    this.leads.set(id, next);
    return structuredClone(next);
  }

  async insertTouch(input: LeadTouchInput) {
    this.touches.push(input);
  }

  async insertFunnelEvent(input: {
    lead_id: string;
    session_id: string | null;
    type: FunnelEventType;
    stage: string;
    meta?: Record<string, unknown>;
    at: string;
  }) {
    this.funnel.push(input);
  }

  async anonymiseLead(
    id: string,
    fields: Partial<LeadRow> & { erased_at: string },
  ) {
    await this.updateLead(id, fields);
  }

  async clearMessageBodies(leadId: string) {
    const convIds = new Set(
      this.conversations.filter((c) => c.lead_id === leadId).map((c) => c.id),
    );
    let n = 0;
    for (const m of this.messages) {
      if (convIds.has(m.conversation_id) && m.body !== "[erased]") {
        m.body = "[erased]";
        n++;
      }
    }
    return n;
  }

  async upsertSuppression(input: SuppressionInput) {
    const idx = this.suppressions.findIndex(
      (s) => s.channel === input.channel && s.value_hash === input.value_hash,
    );
    if (idx >= 0) this.suppressions[idx] = input;
    else this.suppressions.push(input);
  }

  async isSuppressed(valueType: "phone_e164" | "email", valueHash: string) {
    return this.suppressions.some(
      (s) => s.value_type === valueType && s.value_hash === valueHash,
    );
  }

  async insertAudit(input: AuditInput) {
    this.audits.push(input);
  }

  /** Test helper: seed a conversation + message for erasure cascade. */
  seedMessage(leadId: string, body: string) {
    const conversation_id = crypto.randomUUID();
    this.conversations.push({ id: conversation_id, lead_id: leadId });
    this.messages.push({
      id: crypto.randomUUID(),
      conversation_id,
      body,
    });
  }
}
