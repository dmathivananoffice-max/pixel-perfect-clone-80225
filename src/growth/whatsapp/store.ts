import type { AssetRecord } from "../assets/types";
import type { CounsellingSlot } from "./booking";
import type {
  ConversationRecord,
  EscalationTrigger,
  LlmUsageEvent,
  MessageRecord,
  ObjectionCode,
  TokenBudget,
} from "./types";

export type FilterLogRow = {
  conversation_id: string;
  lead_id: string;
  original_text: string;
  matched_rules: string[];
  fallback_text: string;
};

export type QueueRow = {
  lead_id: string;
  conversation_id: string;
  reason: string;
  trigger_code: EscalationTrigger;
  payload?: Record<string, unknown>;
};

export type WhatsAppStore = {
  getOrCreateConversation(input: {
    lead_id: string;
    wa_phone: string;
    diagnostic_summary?: string;
  }): Promise<ConversationRecord>;
  getConversation(id: string): Promise<ConversationRecord | null>;
  updateConversation(
    id: string,
    patch: Partial<ConversationRecord>,
  ): Promise<ConversationRecord>;
  addMessage(input: {
    conversation_id: string;
    direction: "inbound" | "outbound";
    body: string;
    template_ref?: string | null;
    agent_meta?: Record<string, unknown> | null;
  }): Promise<MessageRecord>;
  listApprovedFaqs(): Promise<AssetRecord[]>;
  getAsset(id: string): Promise<AssetRecord | null>;
  listOpenSlots(): Promise<CounsellingSlot[]>;
  bookSlot(slotId: string, leadId: string): Promise<CounsellingSlot>;
  getTemplate(name: string): Promise<{ name: string; body: string; meta_template_name: string } | null>;
  logObjection(input: {
    lead_id: string;
    verbatim: string;
    taxonomy_code: ObjectionCode;
  }): Promise<void>;
  logFilterHit(row: FilterLogRow): Promise<void>;
  enqueueCounsellor(row: QueueRow): Promise<void>;
  logLlmUsage(event: LlmUsageEvent): Promise<void>;
  getTokenBudget(): Promise<TokenBudget>;
  getFaqThreshold(): Promise<number>;
};
