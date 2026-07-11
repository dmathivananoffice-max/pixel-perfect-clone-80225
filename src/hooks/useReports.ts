import { useMemo } from 'react';
import { mockCandidates, mockActivityItems } from '@/lib/mockData';
import type { DashboardMetrics } from '@/types';

export function useReports(): DashboardMetrics {
  return useMemo(() => {
    const candidates = mockCandidates;
    const totalCandidates = candidates.length;
    const shortlisted = candidates.filter((c) => c.status === 'shortlisted').length;
    const rejected = candidates.filter((c) => c.status === 'rejected').length;
    const inVisa = candidates.filter((c) => c.status === 'visa').length;
    const placed = candidates.filter((c) => c.status === 'placed').length;
    const pendingInterviews = candidates.filter((c) => c.status === 'interview1' || c.status === 'interview2').length;
    const pendingContracts = candidates.filter((c) => c.status === 'contract').length;
    const pendingSTI = candidates.filter((c) => c.status === 'shortlisted' || c.status === 'waiting').length;

    const candidatesByStatus = [
      { status: 'Waiting', count: candidates.filter((c) => c.status === 'waiting').length },
      { status: 'Shortlisted', count: shortlisted },
      { status: 'Rejected', count: rejected },
      { status: 'Interview 1', count: candidates.filter((c) => c.status === 'interview1').length },
      { status: 'Interview 2', count: candidates.filter((c) => c.status === 'interview2').length },
      { status: 'Contract', count: pendingContracts },
      { status: 'Visa', count: inVisa },
      { status: 'Placed', count: placed },
      { status: 'Withdrawn', count: candidates.filter((c) => c.status === 'withdrawn').length },
    ];

    const monthlyPlacements = [
      { month: 'Jul', count: 1 },
      { month: 'Aug', count: 2 },
      { month: 'Sep', count: 1 },
      { month: 'Oct', count: 2 },
      { month: 'Nov', count: 3 },
      { month: 'Dec', count: 2 },
    ];

    const programCounts: Record<string, number> = {};
    candidates.forEach((c) => {
      programCounts[c.program_name || 'Unknown'] = (programCounts[c.program_name || 'Unknown'] || 0) + 1;
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
      recentActivity: mockActivityItems.slice(0, 8),
    };
  }, []);
}
