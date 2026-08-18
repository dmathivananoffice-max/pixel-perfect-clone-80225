import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";

import { usePaginatedCandidates } from "@/hooks/usePaginatedCandidates";
import {
  BIN_RETENTION_DAYS,
  daysLeftInBin,
  purgeCandidates,
  restoreCandidates,
} from "@/lib/candidates/bin";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export default function CandidateBin() {
  const navigate = useNavigate();
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pendingPurge, setPendingPurge] = useState<string[] | null>(null);

  const { candidates, total, loading, error } = usePaginatedCandidates({
    page,
    pageSize: PAGE_SIZE,
    deleted: true,
    reloadKey,
  });

  const refresh = () => setReloadKey((k) => k + 1);

  const restore = async (ids: string[]) => {
    setBusy(true);
    try {
      await restoreCandidates(ids);
      toast.success(ids.length === 1 ? "Candidate restored" : `${ids.length} candidates restored`);
      refresh();
    } catch (e) {
      toast.error("Restore failed", { description: e instanceof Error ? e.message : "Unknown" });
    } finally {
      setBusy(false);
    }
  };

  const confirmPurge = async () => {
    if (!pendingPurge) return;
    setBusy(true);
    try {
      await purgeCandidates(pendingPurge);
      toast.success("Deleted permanently");
      setPendingPurge(null);
      refresh();
    } catch (e) {
      toast.error("Delete failed", { description: e instanceof Error ? e.message : "Unknown" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <div className="sticky top-16 z-20 -mx-4 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Trash2 className="size-5 text-muted-foreground" /> Recycle bin
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              <span className="tabular-nums">{total}</span> deleted candidate
              {total === 1 ? "" : "s"} · automatically removed after {BIN_RETENTION_DAYS} days
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/candidates")}>
              <ArrowLeft className="size-4" /> Back to candidates
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              disabled={candidates.length === 0 || busy}
              onClick={() => setPendingPurge(candidates.map((c) => c.candidate_id))}
            >
              <Trash2 className="size-4" /> Empty bin
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead className="bg-muted/40">
            <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
              <Th>Candidate</Th>
              <Th>Program</Th>
              <Th>Deleted</Th>
              <Th>Auto-delete in</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {error && (
              <tr>
                <td colSpan={5} className="py-14 text-center text-sm text-destructive">
                  {error}
                </td>
              </tr>
            )}
            {!error && !loading && candidates.length === 0 && (
              <tr>
                <td colSpan={5} className="py-14 text-center text-sm text-muted-foreground">
                  The bin is empty.
                </td>
              </tr>
            )}
            {candidates.map((c) => {
              const left = c.deleted_at ? daysLeftInBin(c.deleted_at) : BIN_RETENTION_DAYS;
              return (
                <tr key={c.candidate_id} className="border-t border-border/60">
                  <Td>
                    <p className="font-medium">
                      {c.first_name} {c.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                  </Td>
                  <Td className="text-xs text-muted-foreground">{c.program_name ?? "—"}</Td>
                  <Td className="text-xs text-muted-foreground">
                    {c.deleted_at ? new Date(c.deleted_at).toLocaleDateString() : "—"}
                    {c.deleted_by_name ? ` · ${c.deleted_by_name}` : ""}
                  </Td>
                  <Td>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                        left <= 3
                          ? "bg-red-50 text-red-700 ring-red-200"
                          : "bg-amber-50 text-amber-700 ring-amber-200",
                      )}
                    >
                      {left} day{left === 1 ? "" : "s"}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                        disabled={busy}
                        onClick={() => void restore([c.candidate_id])}
                      >
                        <RotateCcw className="size-3.5" /> Restore
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-destructive hover:text-destructive"
                        disabled={busy}
                        onClick={() => setPendingPurge([c.candidate_id])}
                      >
                        <Trash2 className="size-3.5" /> Delete now
                      </Button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
          <span>{loading ? "Loading…" : `Page ${page} · ${total} in bin`}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              disabled={page * PAGE_SIZE >= total || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={pendingPurge != null} onOpenChange={(o) => !o && !busy && setPendingPurge(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Permanently delete {pendingPurge?.length ?? 0} candidate
              {pendingPurge?.length === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Do you really want to delete this permanently? Their documents, extractions,
              assessments and interviews are removed as well. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void confirmPurge();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "h-9 whitespace-nowrap border-b border-border/60 px-3 text-left font-medium",
        className,
      )}
    >
      {children}
    </th>
  );
}
function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("h-14 px-3 align-middle", className)}>{children}</td>;
}
