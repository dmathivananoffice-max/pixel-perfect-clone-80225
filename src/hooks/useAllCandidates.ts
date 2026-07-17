import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Candidate } from '@/types';

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
    source_type: r.source_type as Candidate['source_type'],
    source_agency_id: r.source_agency_id ?? undefined,
    source_agency_name: r.source_agency_name ?? undefined,
    assigned_recruiter_id: r.assigned_recruiter_id ?? undefined,
    assigned_recruiter_name: r.assigned_recruiter_name ?? undefined,
    status: r.status as Candidate['status'],
    gate_status: r.gate_status as Candidate['gate_status'],
    total_score: r.total_score ?? undefined,
    rank: r.rank ?? undefined,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/**
 * Loads every candidate row from the live database. Shared across
 * Dashboard, CandidateList, and RecruiterDashboard so all three views
 * reflect the same real data.
 */
export function useAllCandidates() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('candidates')
        .select('*')
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (data) setCandidates((data as CandidateRow[]).map(rowToCandidate));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { candidates, loading };
}
