import { AlertTriangle } from "lucide-react";

function hhmm(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function mmss(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MigrationBanner({
  resumeAt,
  remainingMs,
  readOnly,
}: {
  resumeAt: Date;
  remainingMs: number;
  readOnly: boolean;
}) {
  const resume = hhmm(resumeAt);
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950"
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="size-4 shrink-0" />
        <span>
          Intake is being upgraded. Verification resumes at {resume}. Your saved work is
          safe.
        </span>
      </div>
      <span className="shrink-0 font-mono text-xs tabular-nums">
        {readOnly ? "Read-only" : `Flush ${mmss(remainingMs)}`}
      </span>
    </div>
  );
}
