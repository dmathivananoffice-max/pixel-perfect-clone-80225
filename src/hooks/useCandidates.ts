import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

interface AuditRow {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  actor_id: string | null;
  actor_name: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
}

interface ScoreRow {
  id: string;
  candidate_id: string;
  scoring_model_id: string | null;
  criteria_name: string;
  raw_score: number | null;
  normalized_score: number | null;
  weighted_score: number | null;
  gate_status: string;
}

function rowToAudit(r: AuditRow): AuditEvent {
  return {
    id: r.id,
    entity_type: r.entity_type as AuditEvent['entity_type'],
    entity_id: r.entity_id,
    event_type: r.event_type as AuditEvent['event_type'],
    actor_id: r.actor_id ?? '',
    actor_name: r.actor_name ?? '',
    old_value: (r.old_value ?? undefined) as AuditEvent['old_value'],
    new_value: (r.new_value ?? undefined) as AuditEvent['new_value'],
    created_at: r.created_at,
  };
}

function rowToScore(r: ScoreRow): CandidateScore {
  return {
    id: r.id,
    candidate_id: r.candidate_id,
    scoring_model_id: r.scoring_model_id ?? '',
    criteria_name: r.criteria_name,
    raw_score: r.raw_score ?? 0,
    normalized_score: r.normalized_score ?? 0,
    weighted_score: r.weighted_score ?? 0,
    gate_status: r.gate_status as CandidateScore['gate_status'],
  };
}

export function useCandidates() {
  const [filters, setFilters] = useState<FilterParams>({});
  const [rows, setRows] = useState<Candidate[]>([]);
  const [documents, setDocuments] = useState<CandidateDocument[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [scores, setScores] = useState<CandidateScore[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [cRes, dRes, aRes, sRes] = await Promise.all([
        supabase.from('candidates').select('*').order('created_at', { ascending: false }),
        supabase.from('candidate_documents').select('*'),
        supabase.from('audit_events').select('*').order('created_at', { ascending: false }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from as any)('candidate_scores').select('*'),
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
      if (aRes.data) setAuditEvents((aRes.data as AuditRow[]).map(rowToAudit));
      if (sRes.data) setScores((sRes.data as ScoreRow[]).map(rowToScore));
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
    getCandidateAuditEvents: (id: string): AuditEvent[] =>
      auditEvents.filter((a) => a.entity_id === id),
    getCandidateScores: (id: string): CandidateScore[] =>
      scores.filter((s) => s.candidate_id === id),
    totalCount: candidates.length,
  };
}
