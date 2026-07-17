import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DashboardMetrics, Candidate } from '@/types';

interface CandidateRow {
  status: string;
  program_name: string | null;
  created_at: string;
}

interface AuditRow {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  actor_name: string | null;
  new_value: unknown;
  created_at: string;
}

function humanize(event: AuditRow): string {
  const label = event.event_type.replace(/_/g, ' ');
  const nv = event.new_value as { status?: string; note?: string } | null;
  if (nv?.status) return `${label} → ${nv.status}`;
  if (nv?.note) return `${label}: ${nv.note}`;
  return `${label} on ${event.entity_type}`;
}

export function useReports(): DashboardMetrics {
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [events, setEvents] = useState<AuditRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [cRes, eRes] = await Promise.all([
        supabase.from('candidates').select('status, program_name, created_at'),
        supabase
          .from('audit_events')
          .select('id, entity_type, entity_id, event_type, actor_name, new_value, created_at')
          .order('created_at', { ascending: false })
          .limit(8),
      ]);
      if (cancelled) return;
      if (cRes.data) setRows(cRes.data as CandidateRow[]);
      if (eRes.data) setEvents(eRes.data as AuditRow[]);
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

    const recentActivity = events.map((e) => ({
      id: e.id,
      type: e.event_type,
      description: humanize(e),
      actor: e.actor_name ?? 'System',
      timestamp: e.created_at,
      entityType: e.entity_type,
      entityId: e.entity_id,
    }));

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
      recentActivity,
    };
  }, [rows, events]);
}
