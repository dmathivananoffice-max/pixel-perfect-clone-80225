import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Real per-candidate assessment scores, sourced from the `assessments`
 * and `interviews` tables (written by the STI / training / interview
 * modules). Never returns fabricated numbers — a missing entry simply
 * means "not yet assessed".
 */
export interface CandidateAssessmentSummary {
  speaking: number | null;
  training: number | null;
  interview1: number | null;
  interview2: number | null;
}

interface AssessmentRow {
  candidate_id: string;
  kind: string;
  overall_score: number | null;
}

interface InterviewRow {
  candidate_id: string;
  round: string;
  rating: number | null;
}

export function useAssessments(candidateIds: string[]) {
  const [map, setMap] = useState<Map<string, CandidateAssessmentSummary>>(new Map());
  const [loading, setLoading] = useState(false);

  const key = candidateIds.slice().sort().join(",");

  useEffect(() => {
    if (candidateIds.length === 0) {
      setMap(new Map());
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [aRes, iRes] = await Promise.all([
        supabase
          .from("assessments")
          .select("candidate_id, kind, overall_score")
          .in("candidate_id", candidateIds),
        supabase
          .from("interviews")
          .select("candidate_id, round, rating")
          .in("candidate_id", candidateIds),
      ]);
      if (cancelled) return;

      const next = new Map<string, CandidateAssessmentSummary>();
      const ensure = (id: string) => {
        let entry = next.get(id);
        if (!entry) {
          entry = { speaking: null, training: null, interview1: null, interview2: null };
          next.set(id, entry);
        }
        return entry;
      };

      for (const row of (aRes.data ?? []) as AssessmentRow[]) {
        const entry = ensure(row.candidate_id);
        if (row.kind === "speaking") entry.speaking = row.overall_score;
        else if (row.kind === "training") entry.training = row.overall_score;
      }
      for (const row of (iRes.data ?? []) as InterviewRow[]) {
        const entry = ensure(row.candidate_id);
        if (row.round === "interview1") entry.interview1 = row.rating;
        else if (row.round === "interview2") entry.interview2 = row.rating;
      }

      setMap(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { assessments: map, loading };
}
