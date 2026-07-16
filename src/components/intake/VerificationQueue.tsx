import { useMemo } from 'react';
import { CheckCircle2, AlertTriangle, GitMerge, Eye, Sparkles, ArrowLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { BatchCandidate, BatchStatus, IntakeBatch } from '@/lib/intake/batch';
import { statusMeta } from '@/lib/intake/batch';

export interface QueueProgress {
  verifiedCount: number;
  totalSections: number;
  currentSectionLabel: string;
  approved: boolean;
}

const STATUS_PRIORITY: Record<BatchStatus, number> = {
  ready: 1,
  manual_review: 2,
  missing_docs: 3,
  low_confidence: 4,
  duplicate: 5,
  approved: 99,
};

function statusIcon(s: BatchStatus) {
  switch (s) {
    case 'approved':       return <CheckCircle2 className="size-3.5 text-emerald-600" />;
    case 'ready':          return <span className="size-2 rounded-full bg-emerald-500" />;
    case 'missing_docs':   return <AlertTriangle className="size-3.5 text-rose-500" />;
    case 'manual_review':  return <Eye className="size-3.5 text-violet-600" />;
    case 'low_confidence': return <AlertTriangle className="size-3.5 text-orange-500" />;
    case 'duplicate':      return <GitMerge className="size-3.5 text-amber-600" />;
  }
}

export function VerificationQueue({
  batch,
  activeCandidateId,
  approvedIds,
  progressMap,
  onSelectCandidate,
  onReturnToDashboard,
}: {
  batch: IntakeBatch;
  activeCandidateId: string | null;
  approvedIds: Set<string>;
  progressMap: Record<string, QueueProgress>;
  onSelectCandidate: (id: string) => void;
  onReturnToDashboard: () => void;
}) {
  const ordered = useMemo(() => {
    const list = batch.candidates.map((c) =>
      approvedIds.has(c.id) ? { ...c, status: 'approved' as BatchStatus } : c,
    );
    return [...list].sort((a, b) => {
      if (a.id === activeCandidateId) return -1;
      if (b.id === activeCandidateId) return 1;
      return (STATUS_PRIORITY[a.status] ?? 50) - (STATUS_PRIORITY[b.status] ?? 50);
    });
  }, [batch, activeCandidateId, approvedIds]);

  const approvedCount = ordered.filter((c) => c.status === 'approved').length;

  return (
    <aside className="hidden lg:flex w-[280px] shrink-0 flex-col border-r border-border/60 bg-muted/20">
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          <Sparkles className="size-3" /> Verification Queue
        </div>
        <div className="mt-1 truncate text-[13px] font-semibold">{batch.name}</div>
        <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
          {approvedCount} / {ordered.length} approved
        </div>
        <Progress value={(approvedCount / Math.max(1, ordered.length)) * 100} className="mt-1.5 h-1" />
      </div>

      <ul className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
        {ordered.map((c) => {
          const active = c.id === activeCandidateId;
          const prog = progressMap[c.id];
          const meta = statusMeta(c.status);
          const pct = prog
            ? Math.round((prog.verifiedCount / Math.max(1, prog.totalSections)) * 100)
            : 0;
          return (
            <li key={c.id}>
              <button
                onClick={() => onSelectCandidate(c.id)}
                className={cn(
                  'group w-full rounded-lg border px-3 py-2 text-left transition',
                  active
                    ? 'border-primary bg-background shadow-sm ring-1 ring-primary/30'
                    : 'border-transparent hover:border-border/60 hover:bg-background',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="shrink-0">{statusIcon(c.status)}</span>
                  <span className="truncate text-[13px] font-medium">
                    {c.firstName} {c.lastName}
                  </span>
                  {active && <ChevronRight className="ml-auto size-3.5 text-primary" />}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="truncate">{c.country}</span>
                  <span aria-hidden>·</span>
                  <span className={cn('rounded px-1 py-0.5 ring-1 truncate', meta.tone)}>
                    {meta.label}
                  </span>
                </div>
                {prog && !prog.approved && (
                  <div className="mt-1.5">
                    <Progress value={pct} className="h-1" />
                    <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="truncate">{prog.currentSectionLabel}</span>
                      <span className="tabular-nums shrink-0">{pct}%</span>
                    </div>
                  </div>
                )}
                {prog?.approved && (
                  <div className="mt-1 text-[10px] font-medium text-emerald-700">
                    ✓ Approved
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-border/60 p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onReturnToDashboard}
          className="w-full justify-start gap-1.5 text-xs"
        >
          <ArrowLeft className="size-3.5" /> Mission Control
        </Button>
      </div>
    </aside>
  );
}
