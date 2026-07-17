import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { mockAuditEvents, mockCandidateScores } from '@/lib/mockData';
import type {
  Candidate,
  CandidateDocument,
  AuditEvent,
  CandidateScore,
  FilterParams,
} from '@/types';

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

export function useCandidates() {
  const [filters, setFilters] = useState<FilterParams>({});
  const [rows, setRows] = useState<Candidate[]>([]);
  const [documents, setDocuments] = useState<CandidateDocument[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [cRes, dRes] = await Promise.all([
        supabase.from('candidates').select('*').order('created_at', { ascending: false }),
        supabase.from('candidate_documents').select('*'),
      ]);
      if (cancelled) return;
      if (cRes.data) setRows((cRes.data as CandidateRow[]).map(rowToCandidate));
      if (dRes.data) {
        setDocuments(
          dRes.data.map((d) => ({
            id: d.id,
            candidate_id: d.candidate_id,
            document_type: d.document_type as CandidateDocument['document_type'],
            uploaded_by: d.uploaded_by ?? '',
            file_path: d.storage_path,
            encrypted: false,
            verified: d.verified,
            verified_by: d.verified_by ?? undefined,
            ocr_complete: d.ocr_complete,
            ocr_confidence: d.ocr_confidence ?? undefined,
            expiry_date: d.expiry_date ?? undefined,
            created_at: d.created_at,
          })),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const candidates = useMemo(() => {
    let data = [...rows];
    if (filters.status) data = data.filter((c) => c.status === filters.status);
    if (filters.program) data = data.filter((c) => c.program_id === filters.program);
    if (filters.source) data = data.filter((c) => c.source_type === filters.source);
    if (filters.agency) data = data.filter((c) => c.source_agency_id === filters.agency);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      data = data.filter(
        (c) =>
          c.first_name.toLowerCase().includes(q) ||
          c.last_name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q),
      );
    }
    if (filters.scoreMin !== undefined) data = data.filter((c) => (c.total_score || 0) >= filters.scoreMin!);
    if (filters.scoreMax !== undefined) data = data.filter((c) => (c.total_score || 0) <= filters.scoreMax!);

    if (filters.sortBy) {
      const order = filters.sortOrder === 'desc' ? -1 : 1;
      data.sort((a, b) => {
        const aVal = (a as unknown as Record<string, unknown>)[filters.sortBy!];
        const bVal = (b as unknown as Record<string, unknown>)[filters.sortBy!];
        if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * order;
        return String(aVal || '').localeCompare(String(bVal || '')) * order;
      });
    }
    return data;
  }, [rows, filters]);

  return {
    candidates,
    filters,
    updateFilters: (n: Partial<FilterParams>) => setFilters((p) => ({ ...p, ...n })),
    getCandidate: (id: string): Candidate | undefined => rows.find((c) => c.candidate_id === id),
    getCandidateDocuments: (id: string): CandidateDocument[] =>
      documents.filter((d) => d.candidate_id === id),
    // Audit + scoring tables not populated for real candidates yet — fall back to mocks
    // so existing detail views don't break. Wired to DB in the next slice.
    getCandidateAuditEvents: (id: string): AuditEvent[] =>
      mockAuditEvents.filter((a) => a.entity_id === id),
    getCandidateScores: (id: string): CandidateScore[] =>
      mockCandidateScores.filter((s) => s.candidate_id === id),
    totalCount: candidates.length,
  };
}
