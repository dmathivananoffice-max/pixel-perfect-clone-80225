import { useState } from "react";
import { Loader2, Play, Radio, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { broadcastMigrationPending } from "@/hooks/useMigrationFlush";
import { getAliasResolutionCount } from "@/intake/keyAliases";
import { recaptureAndCheck, runParityChecks, type ParityCheckResult } from "@/lib/intake/parityChecks";
import { captureReadinessSnapshots } from "@/lib/intake/readinessSnapshots";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

function CheckCard({ check }: { check: ParityCheckResult }) {
  return (
    <Card className={cn("border", check.pass ? "border-emerald-200" : "border-rose-200")}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>{check.title}</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest",
              check.pass ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800",
            )}
          >
            {check.pass ? "pass" : "fail"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs text-muted-foreground">
        <p>{check.summary}</p>
        {!check.pass && check.failingRows.length > 0 && (
          <ul className="max-h-40 overflow-auto rounded-md border border-rose-100 bg-rose-50/60 p-2 font-mono text-[10px] text-rose-950">
            {check.failingRows.slice(0, 50).map((row) => (
              <li key={row.id + row.detail}>
                {row.id} — {row.detail}
              </li>
            ))}
            {check.failingRows.length > 50 && <li>… {check.failingRows.length - 50} more</li>}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function Parity() {
  const { isAdmin, user } = useAuth();
  const [checks, setChecks] = useState<ParityCheckResult[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [aliasResolutions, setAliasResolutions] = useState(() => getAliasResolutionCount());

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">No access</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The Parity screen is restricted to administrators.
          </p>
        </div>
      </div>
    );
  }

  const run = async () => {
    setBusy("checks");
    try {
      const result = await runParityChecks();
      setChecks(result);
      setAliasResolutions(getAliasResolutionCount());
      const failed = result.filter((c) => !c.pass).length;
      toast[failed ? "error" : "success"](
        failed ? `${failed} check(s) failed` : "All eight M6 checks passed",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const recapture = async () => {
    setBusy("capture");
    try {
      const { capture, checks: next } = await recaptureAndCheck();
      setChecks(next);
      setAliasResolutions(getAliasResolutionCount());
      if (capture.error) toast.error(capture.error);
      else toast.success(`Captured ${capture.inserted} snapshot(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const flush = async () => {
    setBusy("flush");
    try {
      const { resumeAt } = await broadcastMigrationPending({
        actorName: user?.name ?? "Admin",
      });
      toast.success(`migration_pending broadcast. Resumes ${new Date(resumeAt).toLocaleTimeString()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const snapshotOnly = async () => {
    setBusy("snap");
    try {
      const r = await captureReadinessSnapshots();
      if (r.error) toast.error(r.error);
      else toast.success(`Captured ${r.inserted} snapshot(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const passed = checks?.filter((c) => c.pass).length ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
          <ShieldCheck className="size-3.5" /> Sprint 0 · Addendum B § M6
        </div>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">Parity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Re-runnable safety-net checks. No recruiter-facing intake behaviour is changed here.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">M4 alias resolutions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            <span className="font-mono text-foreground">{aliasResolutions}</span>{" "}
            legacy-key resolution(s) in this session. Incremented on every{" "}
            <span className="font-mono">resolveLegacyKey</span> call.{" "}
            <span className="font-mono">language.exam_date</span> is read-only (fan-out).
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void run()} disabled={!!busy} className="gap-1.5">
          {busy === "checks" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          Run M6 checks
        </Button>
        <Button variant="secondary" onClick={() => void recapture()} disabled={!!busy} className="gap-1.5">
          {busy === "capture" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Recapture snapshots + re-run
        </Button>
        <Button variant="outline" onClick={() => void snapshotOnly()} disabled={!!busy} className="gap-1.5">
          Capture snapshots only
        </Button>
        <Button variant="outline" onClick={() => void flush()} disabled={!!busy} className="gap-1.5">
          {busy === "flush" ? <Loader2 className="size-4 animate-spin" /> : <Radio className="size-4" />}
          Broadcast session flush
        </Button>
      </div>

      {checks && (
        <p className="text-sm text-muted-foreground">
          {passed}/{checks.length} passed
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {(checks ?? []).map((c) => (
          <CheckCard key={c.id} check={c} />
        ))}
      </div>
    </div>
  );
}
