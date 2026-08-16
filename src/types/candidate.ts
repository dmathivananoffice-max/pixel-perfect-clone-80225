export type SourceType = "internal" | "agency" | "direct";

export type CandidateStatus =
  | "waiting"
  | "shortlisted"
  | "rejected"
  | "interview1"
  | "interview2"
  | "contract"
  | "visa"
  | "placed"
  | "withdrawn";

export type GateStatus = "eligible" | "not_placement_ready";

export type DocType =
  | "passport"
  | "visa"
  | "police_clearance"
  | "qualification"
  | "photo"
  | "contract"
  | "offer_letter"
  | "other";

export type AgencyStatus = "active" | "inactive" | "suspended";

export interface Candidate {
  candidate_id: string;
  first_name: string;
  last_name: string;
  dob?: string;
  gender?: string;
  country: string;
  email: string;
  phone: string;
  highest_qualification?: string;
  program_id?: string;
  program_name?: string;
  source_type: SourceType;
  source_agency_id?: string;
  source_agency_name?: string;
  assigned_recruiter_id?: string;
  assigned_recruiter_name?: string;
  status: CandidateStatus;
  gate_status: GateStatus;
  total_score?: number;
  rank?: number;
  /** OCR/AI-extracted fields by section, written by the intake pipeline. */
  extracted_fields?: Record<string, Record<string, string>>;
  created_at: string;
  updated_at: string;
  /** Set when the candidate is in the 30-day recycle bin. */
  deleted_at?: string;
  deleted_by_name?: string;
}

export interface CandidateDocument {
  id: string;
  candidate_id: string;
  document_type: DocType;
  uploaded_by?: string;
  file_path?: string;
  /** Storage object path inside the candidate-documents bucket. */
  storage_path?: string;
  file_name?: string;
  mime_type?: string;
  encrypted?: boolean;
  verified: boolean;
  verified_by?: string;
  ocr_complete: boolean;
  ocr_confidence?: number;
  expiry_date?: string;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  actor_id?: string;
  actor_name?: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  created_at: string;
}

export interface Agency {
  id: string;
  agency_name: string;
  contact_person: string;
  contact_email: string;
  country: string;
  commission_rate?: number;
  status: AgencyStatus;
  created_at: string;
}

export interface Employer {
  id: string;
  name: string;
  type: string;
  city: string;
  country: string;
  contact_person: string;
  email: string;
  created_at: string;
}

export interface RecruitmentProgram {
  id: string;
  program_name: string;
}
