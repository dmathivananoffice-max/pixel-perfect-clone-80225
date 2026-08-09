import type { DiagnosticResult } from "@/growth/diagnostic/types";

type Props = {
  result: DiagnosticResult;
  onContinue: () => void;
};

const BAND_LABEL: Record<DiagnosticResult["band"], string> = {
  READY: "Ready",
  PREPARABLE: "Preparable",
  NOT_YET: "Not yet",
};

export function ResultsScreen({ result, onContinue }: Props) {
  return (
    <div className="diag__shell diag__fade-in">
      <p className="diag__brand">Workforce Europe</p>
      <span className={`diag__band diag__band--${result.band}`}>
        {BAND_LABEL[result.band]}
      </span>
      <h1 className="diag__title">{result.pathway}</h1>
      <p className="diag__muted">
        Realistic timeline: {result.timeline_range.min_months}–
        {result.timeline_range.max_months} months
      </p>

      {result.gaps.length > 0 ? (
        <section className="diag__card">
          <h3>Named gaps</h3>
          <ul>
            {result.gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="diag__card">
          <h3>Named gaps</h3>
          <p className="diag__muted">No blocking gaps on the answers you gave.</p>
        </section>
      )}

      {result.risk_notes.length > 0 ? (
        <section className="diag__card">
          <h3>Honest risk notes</h3>
          <ul>
            {result.risk_notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {result.preparation_path.length > 0 ? (
        <section className="diag__card">
          <h3>Preparation path</h3>
          <ul>
            {result.preparation_path.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
          {result.nurture_track ? (
            <p className="diag__muted" style={{ marginTop: "0.75rem" }}>
              Prep track: {result.nurture_track}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="diag__card">
        <h3>Next step</h3>
        <p className="diag__muted">{result.next_step}</p>
      </section>

      <div className="diag__nav">
        <button
          type="button"
          className="diag__btn diag__btn--primary"
          onClick={onContinue}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
