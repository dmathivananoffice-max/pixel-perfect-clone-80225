import { useMemo, useState } from "react";
import { logObjection } from "@/growth/objections/api";
import {
  TAXONOMY_CODES,
  TAXONOMY_TAP_LABELS,
} from "@/growth/objections/taxonomy";
import type { ObjectionCode, ObjectionRecord } from "@/growth/objections/types";
import { demoLog } from "./localDemo";

const COUNSELLOR_ID =
  (typeof localStorage !== "undefined" &&
    localStorage.getItem("wfe_counsellor_id")) ||
  "counsellor-demo";

type Props = {
  defaultLeadId?: string;
  defaultPathway?: string;
  onLogged?: (row: ObjectionRecord) => void;
};

/** One-tap taxonomy logger — designed for <10s counsellor use. */
export function CounsellorLog({
  defaultLeadId = "",
  defaultPathway = "nursing-professional",
  onLogged,
}: Props) {
  const [code, setCode] = useState<ObjectionCode | null>(null);
  const [leadId, setLeadId] = useState(defaultLeadId);
  const [pathway, setPathway] = useState(defaultPathway);
  const [verbatim, setVerbatim] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const started = useMemo(() => performance.now(), []);

  const save = async (picked?: ObjectionCode) => {
    const taxonomy_code = picked ?? code;
    if (!taxonomy_code) {
      setErr("Tap a reason first");
      return;
    }
    setBusy(true);
    setErr(null);
    setOk(null);
    const input = {
      lead_id: leadId || null,
      source: "counsellor" as const,
      taxonomy_code,
      verbatim: verbatim || undefined,
      logged_by: COUNSELLOR_ID,
      pathway: pathway || null,
    };
    try {
      let row: ObjectionRecord;
      try {
        row = (await logObjection(input)).objection;
      } catch {
        row = await demoLog(input);
      }
      const ms = Math.round(performance.now() - started);
      setOk(`Logged ${taxonomy_code} in ${ms}ms`);
      setCode(taxonomy_code);
      setVerbatim("");
      onLogged?.(row);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "log failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="obj__panel" data-testid="counsellor-log">
      <p className="obj__meta">Tap a code — optional note — save. Target &lt;10s.</p>
      <div className="obj__taps" role="listbox" aria-label="Objection taxonomy">
        {TAXONOMY_CODES.filter((c) => c !== "UNCLASSIFIED").map((c) => (
          <button
            key={c}
            type="button"
            className="obj__tap"
            data-testid={`tap-${c}`}
            data-selected={code === c}
            disabled={busy}
            onClick={() => {
              setCode(c);
              void save(c);
            }}
          >
            {TAXONOMY_TAP_LABELS[c]}
          </button>
        ))}
      </div>
      <div className="obj__row">
        <label>
          Lead id (optional)
          <input
            value={leadId}
            onChange={(e) => setLeadId(e.target.value)}
            placeholder="uuid or leave blank"
            data-testid="log-lead"
          />
        </label>
        <label>
          Pathway
          <select
            value={pathway}
            onChange={(e) => setPathway(e.target.value)}
            data-testid="log-pathway"
          >
            <option value="nursing-professional">nursing-professional</option>
            <option value="nursing-ausbildung">nursing-ausbildung</option>
            <option value="unknown">unknown</option>
          </select>
        </label>
        <label>
          Verbatim (optional)
          <textarea
            rows={2}
            value={verbatim}
            onChange={(e) => setVerbatim(e.target.value)}
            placeholder="Short quote from the call"
            data-testid="log-verbatim"
          />
        </label>
      </div>
      <div className="obj__actions">
        <button
          type="button"
          className="obj__btn"
          disabled={busy || !code}
          data-testid="log-save"
          onClick={() => void save()}
        >
          Save again
        </button>
      </div>
      {ok ? <p className="obj__ok" data-testid="log-ok">{ok}</p> : null}
      {err ? <p className="obj__err">{err}</p> : null}
    </div>
  );
}
