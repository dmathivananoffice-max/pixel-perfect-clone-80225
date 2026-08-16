import { useMemo } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  GitMerge,
  Eye,
  Sparkles,
  ArrowLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { BatchStatus, IntakeBatch } from "@/lib/intake/batch";
import { statusMeta } from "@/lib/intake/batch";

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

// Spec palette:
// 🔵 currently verifying · 🟢 approved · ⚪ ready · 🟡 manual review
// 🔴 missing docs · 🟠 duplicate · ⚫ waiting for AI (low_confidence proxy)
function statusIcon(s: BatchStatus, active: boolean) {
  if (active) return <span className="size-2 rounded-full bg-blue-500 ring-2 ring-blue-200" />;
  switch (s) {
    case "approved":
      return <CheckCircle2 className="size-3.5 text-emerald-600" />;
    case "ready":
      return <span className="size-2 rounded-full bg-slate-300 ring-1 ring-slate-400" />;
    case "missing_docs":
      return <AlertTriangle className="size-3.5 text-rose-500" />;
    case "manual_review":
      return <span className="size-2 rounded-full bg-amber-400" />;
    case "low_confidence":
      return <Clock className="size-3.5 text-zinc-500" />;
    case "duplicate":
      return <GitMerge className="size-3.5 text-orange-500" />;
  }
}

function statusLabel(s: BatchStatus, active: boolean) {
  if (active) return "Currently verifying";
  switch (s) {
    case "approved":
      return "Approved";
    case "ready":
      return "Ready";
    case "missing_docs":
      return "Missing docs";
    case "manual_review":
      return "Manual review";
    case "low_confidence":
      return "Waiting for AI";
    case "duplicate":
      return "Duplicate";
  }
}

function statusTone(s: BatchStatus, active: boolean) {
  if (active) return "bg-blue-50 text-blue-700 ring-blue-200";
  switch (s) {
    case "approved":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "ready":
      return "bg-slate-50 text-slate-600 ring-slate-200";
    case "missing_docs":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    case "manual_review":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "low_confidence":
      return "bg-zinc-100 text-zinc-600 ring-zinc-200";
    case "duplicate":
      return "bg-orange-50 text-orange-700 ring-orange-200";
  }
}

export function VerificationQueue({
  batch,
  activeCandidateId,
  approvedIds,
  progressMap,
  nextUpId,
  onSelectCandidate,
  onReturnToDashboard,
}: {
  batch: IntakeBatch;
  activeCandidateId: string | null;
  approvedIds: Set<string>;
  progressMap: Record<string, QueueProgress>;
  /** Candidate to visually pre-highlight as "next up" (does NOT auto-open). */
  nextUpId?: string | null;
  onSelectCandidate: (id: string) => void;
  onReturnToDashboard: () => void;
}) {
  const ordered = useMemo(() => {
    const list = batch.candidates.map((c) =>
      approvedIds.has(c.id) ? { ...c, status: "approved" as BatchStatus } : c,
    );
    return [...list].sort((a, b) => {
      if (a.id === activeCandidateId) return -1;
      if (b.id === activeCandidateId) return 1;
      return (STATUS_PRIORITY[a.status] ?? 50) - (STATUS_PRIORITY[b.status] ?? 50);
    });
  }, [batch, activeCandidateId, approvedIds]);

  const approvedCount = ordered.filter((c) => c.status === "approved").length;

  return (
    <aside className="hidden lg:flex w-[280px] shrink-0 flex-col border-r border-border/60 bg-muted/20">
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          <Sparkles className="size-3" /> Verification Queue
        </div>
        <div className="mt-1 truncate text-[13px] font-semibold">{batch.name}</div>
        <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {batch.productLabel}
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
          {approvedCount} / {ordered.length} approved
        </div>
        <Progress
          value={(approvedCount / Math.max(1, ordered.length)) * 100}
          className="mt-1.5 h-1"
        />
      </div>

      <ul className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
        {ordered.map((c) => {
          const active = c.id === activeCandidateId;
          const isApproved = c.status === "approved";
          const isNextUp = !active && !isApproved && c.id === nextUpId;
          const prog = progressMap[c.id];
          const pct = prog
            ? Math.round((prog.verifiedCount / Math.max(1, prog.totalSections)) * 100)
            : 0;

          // Approved rows collapse to a compact single line
          if (isApproved) {
            return (
              <li key={c.id}>
                <button
                  onClick={() => onSelectCandidate(c.id)}
                  className="group flex w-full items-center gap-2 rounded-lg border border-transparent px-3 py-1.5 text-left hover:border-border/60 hover:bg-background"
                >
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                  <span className="truncate text-[12px] font-medium text-emerald-800">
                    {c.firstName} {c.lastName}
                  </span>
                  <span className="ml-auto text-[10px] text-emerald-700">Approved</span>
                </button>
              </li>
            );
          }

          return (
            <li key={c.id}>
              <button
                onClick={() => onSelectCandidate(c.id)}
                className={cn(
                  "group w-full rounded-lg border px-3 py-2 text-left transition",
                  active
                    ? "border-blue-400 bg-background shadow-sm ring-2 ring-blue-200"
                    : isNextUp
                      ? "border-blue-200 bg-blue-50/50 ring-1 ring-blue-100"
                      : "border-transparent hover:border-border/60 hover:bg-background",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="shrink-0">{statusIcon(c.status, active)}</span>
                  <span className="truncate text-[13px] font-medium">
                    {c.firstName} {c.lastName}
                  </span>
                  {active && <ChevronRight className="ml-auto size-3.5 text-blue-600" />}
                  {isNextUp && (
                    <span className="ml-auto rounded bg-blue-100 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-blue-700">
                      Next
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="truncate">{c.country}</span>
                  <span aria-hidden>·</span>
                  <span
                    className={cn(
                      "rounded px-1 py-0.5 ring-1 truncate",
                      statusTone(c.status, active),
                    )}
                  >
                    {statusLabel(c.status, active)}
                  </span>
                </div>
                {prog && (
                  <div className="mt-1.5">
                    <Progress value={pct} className="h-1" />
                    <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="truncate">{prog.currentSectionLabel}</span>
                      <span className="tabular-nums shrink-0">{pct}%</span>
                    </div>
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
