import { useCallback, useEffect, useState } from "react";
import {
  listIntakes,
  listPathwayStates,
  runGovernor,
  upsertIntake,
} from "@/growth/capacity/api";
import type { IntakeRecord, PathwayCapacityState } from "@/growth/capacity/types";
import {
  demoListIntakes,
  demoListStates,
  demoResolveCta,
  demoRunGovernor,
  demoUpsertIntake,
} from "./localDemo";
import { getPathwayCta } from "@/growth/capacity/api";
import type { WaitlistCta } from "@/growth/capacity/types";
import { IntakeForm } from "./IntakeForm";
import "./capacity.css";

const ADMIN =
  (typeof localStorage !== "undefined" &&
    localStorage.getItem("wfe_capacity_admin_id")) ||
  "capacity-admin";

function nextMonthDate() {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export function CapacityApp() {
  const [intakes, setIntakes] = useState<IntakeRecord[]>([]);
  const [states, setStates] = useState<PathwayCapacityState[]>([]);
  const [pathway, setPathway] = useState("nursing-professional");
  const [batchDate, setBatchDate] = useState(nextMonthDate());
  const [capacity, setCapacity] = useState(20);
  const [filled, setFilled] = useState(18);
  const [label, setLabel] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [ctaPreview, setCtaPreview] = useState<WaitlistCta | null>(null);

  const refresh = useCallback(async () => {
    try {
      let local = false;
      try {
        setIntakes((await listIntakes()).intakes);
        setStates((await listPathwayStates()).states);
        setDemo(false);
      } catch {
        setIntakes(await demoListIntakes());
        setStates(await demoListStates());
        setDemo(true);
        local = true;
      }
      try {
        setCtaPreview(
          local
            ? await demoResolveCta(pathway)
            : (await getPathwayCta(pathway)).cta,
        );
      } catch {
        setCtaPreview(await demoResolveCta(pathway));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "load failed");
    }
  }, [pathway]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async () => {
    setErr(null);
    setMsg(null);
    const input = {
      id: editId ?? undefined,
      pathway,
      batch_date: batchDate,
      capacity,
      filled,
      label: label || null,
      status: "OPEN" as const,
      updated_by: ADMIN,
    };
    try {
      try {
        await upsertIntake(input);
        await runGovernor();
        setDemo(false);
      } catch {
        await demoUpsertIntake(input);
        setDemo(true);
      }
      setMsg(`Saved intake (${filled}/${capacity}) and ran governor`);
      setEditId(null);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "save failed");
    }
  };

  const runNow = async () => {
    try {
      try {
        await runGovernor();
      } catch {
        await demoRunGovernor();
        setDemo(true);
      }
      setMsg("Governor ran");
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "governor failed");
    }
  };

  return (
    <div className="cap">
      <div className="cap__shell">
        <p className="cap__brand">Workforce Europe · Capacity</p>
        <h1 className="cap__title">Capacity governor</h1>
        <p className="cap__sub">
          Manual intake calendar (platform sync later). Hourly governor flags
          pathways at ≥85% fill and switches Diagnostic CTAs to waitlist.
          {demo ? " Local demo store active." : ""}
        </p>

        <div className="cap__grid">
          <section className="cap__panel">
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Intakes</h2>
            <p className="cap__meta">
              {/* INTEGRATION POINT: platform sync will populate these rows */}
              Source: manual admin — platform API sync is a Phase 2 integration
              point.
            </p>
            <table className="cap__table" data-testid="intake-table">
              <thead>
                <tr>
                  <th>Pathway</th>
                  <th>Batch</th>
                  <th>Fill</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {intakes.map((i) => (
                  <tr key={i.id}>
                    <td>{i.pathway}</td>
                    <td>{i.batch_date}</td>
                    <td>
                      {i.filled}/{i.capacity}{" "}
                      ({Math.round((i.filled / Math.max(i.capacity, 1)) * 100)}%)
                    </td>
                    <td>
                      <button
                        type="button"
                        className="cap__btn cap__btn--ghost"
                        onClick={() => {
                          setEditId(i.id);
                          setPathway(i.pathway);
                          setBatchDate(i.batch_date);
                          setCapacity(i.capacity);
                          setFilled(i.filled);
                          setLabel(i.label ?? "");
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 style={{ marginBottom: 0 }}>Pathway flags</h3>
            <table className="cap__table" data-testid="state-table">
              <thead>
                <tr>
                  <th>Pathway</th>
                  <th>Ratio</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {states.map((s) => (
                  <tr key={s.pathway}>
                    <td>{s.pathway}</td>
                    <td>{Math.round(Number(s.fill_ratio) * 100)}%</td>
                    <td>
                      <span
                        className={`cap__flag ${
                          s.waitlist_mode ? "cap__flag--warn" : "cap__flag--ok"
                        }`}
                        data-testid={`flag-${s.pathway}`}
                      >
                        {s.waitlist_mode ? "WAITLIST / THROTTLED" : "OPEN"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <IntakeForm
            editId={editId}
            pathway={pathway}
            batchDate={batchDate}
            capacity={capacity}
            filled={filled}
            label={label}
            ctaPreview={ctaPreview}
            msg={msg}
            err={err}
            onPathway={setPathway}
            onBatchDate={setBatchDate}
            onCapacity={setCapacity}
            onFilled={setFilled}
            onLabel={setLabel}
            onSave={() => void save()}
            onRun={() => void runNow()}
          />
        </div>
      </div>
    </div>
  );
}
