import { useMemo, useState } from "react";
import { EXIT_SURVEY_CHOICES } from "@/growth/objections/taxonomy";
import { demoExitAnswer } from "./localDemo";
import "./objections.css";

/** Web tap-select fallback for Diagnostic exit survey (FR-O-01). */
export function ExitSurveyApp({
  leadId,
  sessionId,
  pathway,
}: {
  leadId?: string;
  sessionId?: string;
  pathway?: string;
}) {
  const lead = leadId || "demo-lead";
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const choices = useMemo(() => EXIT_SURVEY_CHOICES, []);

  const pick = async (n: number, label: string) => {
    setErr(null);
    try {
      const row = await demoExitAnswer({
        reply: String(n),
        lead_id: lead,
        session_id: sessionId,
        pathway: pathway ?? "nursing-professional",
      });
      if (!row) throw new Error("could not map choice");
      setDone(`Thanks — logged as ${row.taxonomy_code} (${label})`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    }
  };

  return (
    <div className="obj">
      <div className="obj__shell">
        <p className="obj__brand">Workforce Europe</p>
        <h1 className="obj__title">What made you pause?</h1>
        <p className="obj__sub">
          One tap helps us improve the Pathway Diagnostic. No judgment — just
          honesty.
        </p>
        {done ? (
          <p className="obj__ok" data-testid="exit-done">{done}</p>
        ) : (
          <div className="obj__taps" data-testid="exit-choices">
            {choices.map((c) => (
              <button
                key={c.n}
                type="button"
                className="obj__tap"
                data-testid={`exit-${c.n}`}
                onClick={() => void pick(c.n, c.label)}
              >
                {c.n}. {c.label}
              </button>
            ))}
          </div>
        )}
        {err ? <p className="obj__err">{err}</p> : null}
      </div>
    </div>
  );
}
