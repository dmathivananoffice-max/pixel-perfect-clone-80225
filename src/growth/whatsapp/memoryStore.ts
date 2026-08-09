import { createMemoryAssetStore } from "../assets/memoryStore";
import type { AssetRecord } from "../assets/types";
import type { CounsellingSlot } from "./booking";
import { DEFAULT_FAQ_THRESHOLD, DEFAULT_TOKEN_BUDGET } from "./constants";
import type { WhatsAppStore } from "./store";
import type { ConversationRecord, MessageRecord } from "./types";

export function createMemoryWhatsAppStore(seedFaqs: AssetRecord[] = []): WhatsAppStore & {
  conversations: Map<string, ConversationRecord>;
  messages: MessageRecord[];
  filterLogs: unknown[];
  queue: unknown[];
  objections: unknown[];
  llmUsage: unknown[];
  assets: ReturnType<typeof createMemoryAssetStore>;
} {
  const assets = createMemoryAssetStore();
  const now = new Date().toISOString();
  for (const f of seedFaqs) {
    assets.assets.set(f.id, {
      ...f,
      created_at: f.created_at ?? now,
      updated_at: f.updated_at ?? now,
    });
  }
  const conversations = new Map<string, ConversationRecord>();
  const byPhone = new Map<string, string>();
  const messages: MessageRecord[] = [];
  const filterLogs: unknown[] = [];
  const queue: unknown[] = [];
  const objections: unknown[] = [];
  const llmUsage: unknown[] = [];
  const slots: CounsellingSlot[] = [
    {
      id: "slot-1",
      starts_at: new Date(Date.now() + 86400000).toISOString(),
      ends_at: new Date(Date.now() + 86400000 + 1800000).toISOString(),
      timezone: "Asia/Kolkata",
      capacity: 1,
      booked: 0,
      status: "OPEN",
      lead_id: null,
    },
  ];
  const templates = new Map([
    [
      "session_reopen",
      {
        name: "session_reopen",
        body: "Hi from Workforce Europe — reply to continue, or ADVISOR for a human.",
        meta_template_name: "wfe_session_reopen",
      },
    ],
    [
      "escalation_ack",
      {
        name: "escalation_ack",
        body: "A human advisor has been notified and will follow up.",
        meta_template_name: "wfe_escalation_ack",
      },
    ],
  ]);

  return {
    conversations,
    messages,
    filterLogs,
    queue,
    objections,
    llmUsage,
    assets,
    async getOrCreateConversation(input) {
      const existing = byPhone.get(input.wa_phone);
      if (existing) return structuredClone(conversations.get(existing)!);
      const now = new Date().toISOString();
      const row: ConversationRecord = {
        id: crypto.randomUUID(),
        lead_id: input.lead_id,
        channel: "whatsapp",
        wa_phone: input.wa_phone,
        opened_at: now,
        closed_at: null,
        handled_by: "agent",
        last_inbound_at: null,
        tokens_in_total: 0,
        tokens_out_total: 0,
        low_confidence_streak: 0,
        agent_state: "active",
        qualification_state: {},
        opt_in_at: now,
        first_outbound_sent: false,
        diagnostic_summary: input.diagnostic_summary ?? null,
      };
      conversations.set(row.id, row);
      byPhone.set(input.wa_phone, row.id);
      return structuredClone(row);
    },
    async getConversation(id) {
      const c = conversations.get(id);
      return c ? structuredClone(c) : null;
    },
    async updateConversation(id, patch) {
      const cur = conversations.get(id);
      if (!cur) throw new Error("conversation not found");
      const next = { ...cur, ...patch };
      conversations.set(id, next);
      return structuredClone(next);
    },
    async addMessage(input) {
      const row: MessageRecord = {
        id: crypto.randomUUID(),
        conversation_id: input.conversation_id,
        direction: input.direction,
        body: input.body,
        template_ref: input.template_ref ?? null,
        agent_meta: input.agent_meta ?? null,
        at: new Date().toISOString(),
      };
      messages.push(row);
      return structuredClone(row);
    },
    async listApprovedFaqs() {
      return assets.listByStatus("APPROVED");
    },
    async getAsset(id) {
      return assets.getById(id);
    },
    async listOpenSlots() {
      return slots.filter((s) => s.status === "OPEN").map((s) => ({ ...s }));
    },
    async bookSlot(slotId, leadId) {
      const slot = slots.find((s) => s.id === slotId);
      if (!slot || slot.status !== "OPEN") throw new Error("slot unavailable");
      slot.booked += 1;
      slot.lead_id = leadId;
      if (slot.booked >= slot.capacity) slot.status = "BOOKED";
      return { ...slot };
    },
    async getTemplate(name) {
      return templates.get(name) ?? null;
    },
    async logObjection(input) {
      objections.push(input);
    },
    async logFilterHit(row) {
      filterLogs.push(row);
    },
    async enqueueCounsellor(row) {
      queue.push(row);
    },
    async logLlmUsage(event) {
      llmUsage.push(event);
    },
    async getTokenBudget() {
      return { ...DEFAULT_TOKEN_BUDGET };
    },
    async getFaqThreshold() {
      return DEFAULT_FAQ_THRESHOLD;
    },
  };
}
