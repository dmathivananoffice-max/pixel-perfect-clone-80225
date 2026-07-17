import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { mockActivityItems } from '@/lib/mockData';
import type { DashboardMetrics, Candidate } from '@/types';

interface CandidateRow {
  status: string;
  program_name: string | null;
  created_at: string;
}

export function useReports(): DashboardMetrics {
  const [rows, setRows] = useState<CandidateRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('candidates')
        .select('status, program_name, created_at');
      if (!cancelled && data) setRows(data as CandidateRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    const totalCandidates = rows.length;
    const byStatus = (s: Candidate['status']) => rows.filter((c) => c.status === s).length;

    const shortlisted = byStatus('shortlisted');
    const rejected = byStatus('rejected');
    const inVisa = byStatus('visa');
    const placed = byStatus('placed');
    const pendingInterviews = byStatus('interview1') + byStatus('interview2');
    const pendingContracts = byStatus('contract');
    const pendingSTI = byStatus('shortlisted') + byStatus('waiting');

    const candidatesByStatus = [
      { status: 'Waiting', count: byStatus('waiting') },
      { status: 'Shortlisted', count: shortlisted },
      { status: 'Rejected', count: rejected },
      { status: 'Interview 1', count: byStatus('interview1') },
      { status: 'Interview 2', count: byStatus('interview2') },
      { status: 'Contract', count: pendingContracts },
      { status: 'Visa', count: inVisa },
      { status: 'Placed', count: placed },
      { status: 'Withdrawn', count: byStatus('withdrawn') },
    ];

    // Group real candidates by created_at month for the last 6 months.
    const months: { key: string; label: string }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleString('en', { month: 'short' }),
      });
    }
    const monthCounts: Record<string, number> = {};
    rows
      .filter((r) => r.status === 'placed')
      .forEach((r) => {
        const d = new Date(r.created_at);
        const k = `${d.getFullYear()}-${d.getMonth()}`;
        monthCounts[k] = (monthCounts[k] ?? 0) + 1;
      });
    const monthlyPlacements = months.map((m) => ({ month: m.label, count: monthCounts[m.key] ?? 0 }));

    const programCounts: Record<string, number> = {};
    rows.forEach((c) => {
      const key = c.program_name || 'Unknown';
      programCounts[key] = (programCounts[key] || 0) + 1;
    });
    const topPrograms = Object.entries(programCounts)
      .map(([program, count]) => ({ program, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalCandidates,
      shortlisted,
      rejected,
      inVisa,
      placed,
      pendingInterviews,
      pendingContracts,
      pendingSTI,
      monthlyPlacements,
      candidatesByStatus,
      topPrograms,
      // Activity feed will read from audit_events in the next slice.
      recentActivity: mockActivityItems.slice(0, 8),
    };
  }, [rows]);
}
