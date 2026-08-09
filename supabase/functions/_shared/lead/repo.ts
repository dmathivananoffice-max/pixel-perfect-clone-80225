import type {
  CaptureLeadRequest,
  ClickIds,
  FunnelEventType,
  LeadRow,
  StoredConsent,
  UtmObject,
} from "./types.ts";

export type InsertLeadInput = {
  phone_e164: string;
  name: string | null;
  email: string | null;
  city: string | null;
  language: string;
  source_utm: UtmObject;
  click_ids: ClickIds;
  first_touch_at: string;
  consent: StoredConsent;
  diagnostic_session_id: string | null;
  platform_candidate_id: string | null;
};

export type LeadTouchInput = {
  lead_id: string;
  at: string;
  source_utm: UtmObject;
  click_ids: ClickIds;
  landing_path: string | null;
  diagnostic_session_id: string | null;
  payload: Record<string, unknown>;
};

export type SuppressionInput = {
  channel: "whatsapp" | "email" | "sms";
  value_hash: string;
  value_type: "phone_e164" | "email";
  lead_id: string;
  reason: string;
};

export type AuditInput = {
  actor: string;
  action: string;
  entity: string;
  before_hash?: string | null;
  after_hash?: string | null;
  gate_results?: Record<string, unknown>;
};

/** DB port for M2 — implemented by Supabase adapter or in-memory test double. */
export interface LeadRepository {
  findByPhone(phoneE164: string): Promise<LeadRow | null>;
  findById(id: string): Promise<LeadRow | null>;
  insertLead(input: InsertLeadInput): Promise<LeadRow>;
  updateLead(id: string, fields: Partial<LeadRow>): Promise<LeadRow>;
  insertTouch(input: LeadTouchInput): Promise<void>;
  insertFunnelEvent(input: {
    lead_id: string;
    session_id: string | null;
    type: FunnelEventType;
    stage: string;
    meta?: Record<string, unknown>;
    at: string;
  }): Promise<void>;
  anonymiseLead(id: string, fields: Partial<LeadRow> & { erased_at: string }): Promise<void>;
  clearMessageBodies(leadId: string): Promise<number>;
  upsertSuppression(input: SuppressionInput): Promise<void>;
  isSuppressed(
    valueType: "phone_e164" | "email",
    valueHash: string,
  ): Promise<boolean>;
  insertAudit(input: AuditInput): Promise<void>;
}

export type CaptureContext = {
  now?: Date;
  request: CaptureLeadRequest;
};
