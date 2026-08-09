/** M9 Capacity governor (FR-G-01…03, FR-N-05). */

export type IntakeStatus = "OPEN" | "WAITLIST" | "CLOSED";

export type IntakeRecord = {
  id: string;
  pathway: string;
  batch_date: string; // YYYY-MM-DD
  capacity: number;
  filled: number;
  label: string | null;
  status: IntakeStatus;
  synced_at: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
};

export type PathwayCapacityState = {
  pathway: string;
  nearest_intake_id: string | null;
  next_intake_id: string | null;
  fill_ratio: number;
  threshold: number;
  pathway_throttled: boolean;
  waitlist_mode: boolean;
  dashboard_flagged: boolean;
  waitlist_copy: string | null;
  nearest_batch_date: string | null;
  next_batch_date: string | null;
  computed_at: string;
  meta: Record<string, unknown>;
};

export type GovernorConfig = {
  fill_threshold: number;
  pathways: string[];
};

export type UrgencyCopyTemplate = {
  id: string;
  key: string;
  body: string;
  intake_id: string | null;
  calendar_event_id: string | null;
  active: boolean;
  updated_by: string;
  updated_at: string;
};

export type WaitlistCta = {
  mode: "open" | "waitlist";
  label: string;
  copy: string;
  intake_id: string | null;
  pathway_throttled: boolean;
  dashboard_flagged: boolean;
};
