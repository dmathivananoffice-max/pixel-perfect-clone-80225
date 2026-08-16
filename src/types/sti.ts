export interface STISpeaking {
  id: string;
  candidate_id: string;
  pronunciation: number;
  fluency: number;
  confidence: number;
  vocabulary: number;
  grammar: number;
  overall_score?: number;
  trainer_notes?: string;
  trainer_name?: string;
  assessed_at?: string;
}

export interface STITraining {
  id: string;
  candidate_id: string;
  attendance?: number;
  assignments?: number;
  behaviour?: number;
  participation?: number;
  german_improvement?: number;
  recommendation?: "proceed" | "caution" | "not_recommended";
  trainer_notes?: string;
  trainer_name?: string;
  assessed_at?: string;
}

export interface STIInterview1 {
  id: string;
  candidate_id: string;
  panel_members: string[];
  date?: string;
  rating?: number;
  notes?: string;
  decision?: "proceed" | "hold" | "reject";
  conductor_name?: string;
  created_at: string;
}

export interface STIInterview2 {
  id: string;
  candidate_id: string;
  employer_id: string;
  employer_name?: string;
  project_manager_name?: string;
  date?: string;
  rating?: number;
  notes?: string;
  decision?: "selected" | "rejected" | "hold";
  created_at: string;
}
