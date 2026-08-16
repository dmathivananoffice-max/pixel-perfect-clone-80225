export interface ScoringModel {
  id: string;
  program_id: string;
  criteria_name: string;
  weightage: number;
  is_gating: boolean;
  minimum_threshold?: number;
  max_score?: number;
}

export interface CandidateScore {
  id: string;
  candidate_id: string;
  scoring_model_id: string;
  criteria_name: string;
  raw_score: number;
  normalized_score?: number;
  weighted_score?: number;
  gate_status: "eligible" | "not_placement_ready";
}

export interface ScoreBreakdown {
  criteria: string;
  weight: number;
  rawScore: number;
  normalizedScore: number;
  weightedScore: number;
  isGating: boolean;
  threshold?: number;
  passed: boolean;
}
