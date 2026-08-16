export type VisaStatusEnum =
  "not_started" | "documents_submitted" | "appointment_booked" | "approved" | "rejected";

export interface VisaStatus {
  id: string;
  candidate_id: string;
  candidate_name?: string;
  status: VisaStatusEnum;
  updated_by?: string;
  notes?: string;
  updated_at: string;
}

export interface ExtractionField {
  field_name: string;
  ai_suggested_value: string;
  human_confirmed_value?: string;
  confidence: number;
  status: "pending" | "confirmed" | "edited";
}

export interface DocumentExtractionJob {
  id: string;
  document_id: string;
  status: "processing" | "completed" | "failed";
  fields: ExtractionField[];
  created_at: string;
}
