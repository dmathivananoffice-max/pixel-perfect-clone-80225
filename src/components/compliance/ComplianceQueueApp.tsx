import { useCallback, useEffect, useState } from "react";
import { getAsset, listInReview, reviewAsset } from "@/growth/assets/api";
import { emptyClaimChecklist } from "@/growth/assets/claims";
import type { AssetRecord, ClaimChecklist } from "@/growth/assets/types";
import {
  demoGet,
  demoListInReview,
  demoResolve,
  demoReview,
} from "./localDemo";
import { AssetDiff } from "./AssetDiff";
import { ClaimChecklistEditor } from "./ClaimChecklistEditor";
import "./compliance.css";

const REVIEWER_ID =
  (typeof localStorage !== "undefined" &&
    localStorage.getItem("wfe_compliance_reviewer_id")) ||
  "00000000-0000-4000-8000-000000000099";

export function ComplianceQueueApp() {
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [current, setCurrent] = useState<AssetRecord | null>(null);
  const [prior, setPrior] = useState<AssetRecord | null>(null);
  const [checklist, setChecklist] = useState<ClaimChecklist>(emptyClaimChecklist());
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [lastApprovedId, setLastApprovedId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await listInReview();
      setAssets(res.assets);
      setDemoMode(false);
    } catch {
      const local = await demoListInReview();
      setDemoMode(true);
      setAssets(local);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function select(id: string) {
    setSelectedId(id);
    setError(null);
    try {
      let res: { asset: AssetRecord; prior: AssetRecord | null };
      try {
        res = await getAsset(id);
        setDemoMode(false);
      } catch {
        res = await demoGet(id);
        setDemoMode(true);
      }
      setCurrent(res.asset);
      setPrior(res.prior);
      setChecklist({
        ...emptyClaimChecklist(),
        ...(res.asset.claim_checklist as ClaimChecklist),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to load asset");
    }
  }

  async function decide(decision: "approve" | "reject") {
    if (!current) return;
    setBusy(true);
    setError(null);
    setResolveNote(null);
    try {
      let reviewed: AssetRecord;
      let local = demoMode;
      try {
        reviewed = (await reviewAsset({
          asset_id: current.id,
          actor_id: REVIEWER_ID,
          decision,
          comment: comment || undefined,
          claim_checklist: checklist,
        })).asset;
        local = false;
        setDemoMode(false);
      } catch {
        reviewed = await demoReview({
          asset_id: current.id,
          actor_id: REVIEWER_ID,
          decision,
          comment: comment || undefined,
          claim_checklist: checklist,
        });
        local = true;
        setDemoMode(true);
      }

      if (decision === "approve" && local) {
        setLastApprovedId(reviewed.id);
        const ok = await demoResolve(reviewed.id);
        setResolveNote(`Send-path resolve OK for APPROVED asset v${ok.version}`);
      }
      setCurrent(null);
      setPrior(null);
      setSelectedId(null);
      setComment("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "review failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="comp">
      <div className="comp__shell">
        <p className="comp__brand">Workforce Europe · Compliance</p>
        <h1 className="comp__title">Compliance queue</h1>
        <p className="comp__sub">
          Review IN_REVIEW claim-bearing assets (G-2).
          {demoMode ? " Local demo queue (edge offline)." : ""}
          {resolveNote ? ` ${resolveNote}` : ""}
          {lastApprovedId ? ` Approved: ${lastApprovedId}` : ""}
        </p>

        <div className="comp__layout">
          <section className="comp__panel">
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>
              In review ({assets.length})
            </h2>
            <div className="comp__list">
              {assets.length === 0 ? (
                <p className="comp__empty">No assets waiting.</p>
              ) : (
                assets.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="comp__item"
                    data-active={selectedId === a.id}
                    onClick={() => void select(a.id)}
                  >
                    <strong>{a.title}</strong>
                    <span className="comp__meta">
                      {a.type} · v{a.version}
                      {a.claim_bearing ? " · claim-bearing" : ""}
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="comp__panel">
            {!current ? (
              <p className="comp__empty">Select an asset to review.</p>
            ) : (
              <>
                <h2 style={{ marginTop: 0 }}>{current.title}</h2>
                <p className="comp__meta">
                  {current.type} · v{current.version} · {current.submitted_at ?? "—"}
                </p>
                <AssetDiff current={current} prior={prior} />
                <h3>Claim checklist</h3>
                <ClaimChecklistEditor value={checklist} onChange={setChecklist} />
                <div className="comp__field">
                  <label htmlFor="comp-comment">Reviewer comment</label>
                  <textarea
                    id="comp-comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Required when rejecting"
                  />
                </div>
                {error ? <p className="comp__error">{error}</p> : null}
                <div className="comp__actions">
                  <button type="button" className="comp__btn comp__btn--ok" disabled={busy} onClick={() => void decide("approve")}>
                    Approve
                  </button>
                  <button type="button" className="comp__btn comp__btn--bad" disabled={busy} onClick={() => void decide("reject")}>
                    Reject
                  </button>
                  <button type="button" className="comp__btn comp__btn--ghost" onClick={() => void refresh()}>
                    Refresh
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
