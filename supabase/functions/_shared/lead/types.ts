/** Shared M2 lead-capture types (FR-L-01 … FR-L-06). */

export type UtmObject = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  /** Landing path is part of source per FR-L-01 */
  landing_path?: string;
  [key: string]: string | undefined;
};

export type ClickIds = {
  gclid?: string;
  fbclid?: string;
  [key: string]: string | undefined;
};

/** Granular consent — no defaults; caller must send explicit booleans (FR-L-03). */
export type ConsentInput = {
  whatsapp: boolean;
  email: boolean;
  assessment_processing: boolean;
  consent_text_version: string;
};

export type StoredConsent = ConsentInput & {
  timestamp: string;
};

export type CaptureLeadRequest = {
  phone: string;
  name?: string;
  email?: string;
  city?: string;
  language?: string;
  utm?: UtmObject;
  click_ids?: ClickIds;
  consent: ConsentInput;
  diagnostic_session_id?: string;
  /** Shared identity key when already converted (FR-L-05). */
  platform_candidate_id?: string;
};

export type CaptureLeadResult = {
  lead_id: string;
  phone_e164: string;
  event: "LEAD_CREATED" | "LEAD_RETURNED";
  created: boolean;
};

export type EraseLeadRequest = {
  lead_id?: string;
  phone?: string;
};

export type EraseLeadResult = {
  lead_id: string;
  erased: true;
  already_erased: boolean;
};

export type LeadRow = {
  id: string;
  phone_e164: string;
  name: string | null;
  email: string | null;
  city: string | null;
  language: string;
  source_utm: UtmObject;
  click_ids: ClickIds;
  first_touch_at: string;
  consent: StoredConsent | Record<string, unknown>;
  du_flag: boolean;
  referrer_lead_id: string | null;
  platform_candidate_id: string | null;
  diagnostic_session_id?: string | null;
  erased_at?: string | null;
};

export type FunnelEventType = "LEAD_CREATED" | "LEAD_RETURNED";
