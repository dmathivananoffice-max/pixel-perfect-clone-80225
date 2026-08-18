import { useEffect } from "react";
import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import type { Candidate } from "@/types";

interface CandidateRow {
  candidate_id: string;
  first_name: string;
  last_name: string;
  dob: string | null;
  gender: string | null;
  country: string;
  email: string;
  phone: string;
  highest_qualification: string | null;
  product_id: string;
  program_name: string | null;
  source_type: string;
  source_agency_id: string | null;
  source_agency_name: string | null;
  assigned_recruiter_id: string | null;
  assigned_recruiter_name: string | null;
  status: string;
  gate_status: string;
  total_score: number | null;
  rank: number | null;
  extracted_fields: Record<string, Record<string, string>> | null;
  created_at: string;
  updated_at: string;
}

function rowToCandidate(r: CandidateRow): Candidate {
  return {
    candidate_id: r.candidate_id,
    first_name: r.first_name,
    last_name: r.last_name,
    dob: r.dob ?? undefined,
    gender: r.gender ?? undefined,
    country: r.country,
    email: r.email,
    phone: r.phone,
    highest_qualification: r.highest_qualification ?? undefined,
    program_id: r.product_id,
    program_name: r.program_name ?? undefined,
    source_type: r.source_type as Candidate["source_type"],
    source_agency_id: r.source_agency_id ?? undefined,
    source_agency_name: r.source_agency_name ?? undefined,
    assigned_recruiter_id: r.assigned_recruiter_id ?? undefined,
    assigned_recruiter_name: r.assigned_recruiter_name ?? undefined,
    status: r.status as Candidate["status"],
    gate_status: r.gate_status as Candidate["gate_status"],
    total_score: r.total_score ?? undefined,
    rank: r.rank ?? undefined,
    extracted_fields: r.extracted_fields ?? undefined,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/**
 * Shared, de-duplicated candidate store. Dashboard, CandidateList,
 * RecruiterDashboard and the selection engine all read the same rows —
 * one fetch per refresh cycle, never three parallel duplicate queries.
 */
interface AllCandidatesState {
  candidates: Candidate[];
  loading: boolean;
  error: string | null;
  fetchedAt: number | null;
  refetch: () => Promise<void>;
}

let inFlight: Promise<void> | null = null;

async function fetchCandidates(set: (p: Partial<AllCandidatesState>) => void) {
  set({ loading: true, error: null });
  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    set({ loading: false, error: error.message });
    return;
  }
  set({
    loading: false,
    candidates: ((data ?? []) as CandidateRow[]).map(rowToCandidate),
    fetchedAt: Date.now(),
  });
}

const useAllCandidatesStore = create<AllCandidatesState>((set) => ({
  candidates: [],
  loading: true,
  error: null,
  fetchedAt: null,
  refetch: () => {
    inFlight ??= fetchCandidates(set).finally(() => {
      inFlight = null;
    });
    return inFlight;
  },
}));

/** Freshness window: components mounting within 30s share the same fetch. */
const STALE_MS = 30_000;

export function useAllCandidates() {
  const { candidates, loading, error, fetchedAt, refetch } = useAllCandidatesStore();

  useEffect(() => {
    const stale = !fetchedAt || Date.now() - fetchedAt > STALE_MS;
    if (stale) void refetch();
  }, [fetchedAt, refetch]);

  return { candidates, loading, error, refetch };
}
