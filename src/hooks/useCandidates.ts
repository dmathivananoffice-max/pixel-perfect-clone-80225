import { useState, useMemo } from 'react';
import { mockCandidates, mockDocuments, mockAuditEvents, mockCandidateScores } from '@/lib/mockData';
import type { Candidate, CandidateDocument, AuditEvent, CandidateScore, FilterParams } from '@/types';

export function useCandidates() {
  const [filters, setFilters] = useState<FilterParams>({});

  const candidates = useMemo(() => {
    let data = [...mockCandidates];

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
          c.email.toLowerCase().includes(q)
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
  }, [filters]);

  const getCandidate = (id: string): Candidate | undefined => {
    return mockCandidates.find((c) => c.candidate_id === id);
  };

  const getCandidateDocuments = (id: string): CandidateDocument[] => {
    return mockDocuments.filter((d) => d.candidate_id === id);
  };

  const getCandidateAuditEvents = (id: string): AuditEvent[] => {
    return mockAuditEvents.filter((a) => a.entity_id === id);
  };

  const getCandidateScores = (id: string): CandidateScore[] => {
    return mockCandidateScores.filter((s) => s.candidate_id === id);
  };

  const updateFilters = (newFilters: Partial<FilterParams>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  return {
    candidates,
    filters,
    updateFilters,
    getCandidate,
    getCandidateDocuments,
    getCandidateAuditEvents,
    getCandidateScores,
    totalCount: candidates.length,
  };
}
