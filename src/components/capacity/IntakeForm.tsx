import type { WaitlistCta } from "@/growth/capacity/types";

type Props = {
  editId: string | null;
  pathway: string;
  batchDate: string;
  capacity: number;
  filled: number;
  label: string;
  ctaPreview: WaitlistCta | null;
  msg: string | null;
  err: string | null;
  onPathway: (v: string) => void;
  onBatchDate: (v: string) => void;
  onCapacity: (v: number) => void;
  onFilled: (v: number) => void;
  onLabel: (v: string) => void;
  onSave: () => void;
  onRun: () => void;
};

export function IntakeForm(p: Props) {
  return (
    <section className="cap__panel">
      <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>
        {p.editId ? "Edit intake" : "Add / set intake"}
      </h2>
      <div className="cap__row">
        <label>
          Pathway
          <select
            value={p.pathway}
            onChange={(e) => p.onPathway(e.target.value)}
            data-testid="cap-pathway"
          >
            <option value="nursing-professional">nursing-professional</option>
            <option value="nursing-ausbildung">nursing-ausbildung</option>
          </select>
        </label>
        <label>
          Batch date
          <input
            type="date"
            value={p.batchDate}
            onChange={(e) => p.onBatchDate(e.target.value)}
            data-testid="cap-batch"
          />
        </label>
        <label>
          Capacity
          <input
            type="number"
            min={0}
            value={p.capacity}
            onChange={(e) => p.onCapacity(Number(e.target.value))}
            data-testid="cap-capacity"
          />
        </label>
        <label>
          Filled
          <input
            type="number"
            min={0}
            value={p.filled}
            onChange={(e) => p.onFilled(Number(e.target.value))}
            data-testid="cap-filled"
          />
        </label>
        <label>
          Label
          <input
            value={p.label}
            onChange={(e) => p.onLabel(e.target.value)}
            placeholder="Optional cohort label"
          />
        </label>
      </div>
      <div className="cap__actions">
        <button
          type="button"
          className="cap__btn"
          data-testid="cap-save"
          onClick={p.onSave}
        >
          Save + run governor
        </button>
        <button
          type="button"
          className="cap__btn cap__btn--ghost"
          data-testid="cap-run"
          onClick={p.onRun}
        >
          Run governor now
        </button>
      </div>
      {p.msg ? <p className="cap__ok" data-testid="cap-ok">{p.msg}</p> : null}
      {p.err ? <p className="cap__err">{p.err}</p> : null}
      {p.ctaPreview ? (
        <div
          className="cap__panel"
          style={{ marginTop: "0.85rem", background: "#fff" }}
          data-testid="cta-preview"
          data-mode={p.ctaPreview.mode}
        >
          <strong>Diagnostic results CTA preview</strong>
          <p className="cap__meta" style={{ margin: "0.35rem 0" }}>
            Button: {p.ctaPreview.label}
          </p>
          <p data-testid="cta-preview-copy">{p.ctaPreview.copy}</p>
        </div>
      ) : null}
      <p className="cap__meta" style={{ marginTop: "0.85rem" }}>
        Tip: set filled to 90% of capacity (e.g. 18/20) to trigger waitlist mode
        on the Diagnostic results CTA.
      </p>
    </section>
  );
}
