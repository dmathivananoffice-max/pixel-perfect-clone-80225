export type ContractType =
  "offer_letter" | "employment" | "training_agreement" | "agency_agreement";
export type ContractStatus = "draft" | "sent" | "signed" | "expired" | "cancelled";

export interface Contract {
  id: string;
  candidate_id: string;
  candidate_name?: string;
  /** Contract kind — optional; stored in metadata for DB-backed rows. */
  type?: ContractType;
  status: ContractStatus;
  employer_id?: string;
  employer_name?: string;
  document_path?: string;
  signed_at?: string;
  file_path?: string;
  created_at: string;
  updated_at: string;
}

export type EmailStatus = "pending" | "sent" | "failed";

export interface EmailLog {
  id: string;
  candidate_id: string;
  candidate_name?: string;
  template: string;
  subject: string;
  sent_by?: string;
  sent_at: string;
  status: EmailStatus;
}

export type EmailTemplate =
  | "offer_letter"
  | "rejection"
  | "interview_invite"
  | "interview_reminder"
  | "contract_ready"
  | "visa_update"
  | "placement_confirmation"
  | "custom";
