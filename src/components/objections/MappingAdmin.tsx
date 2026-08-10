import { useEffect, useState } from "react";
import { listMappings, upsertMapping } from "@/growth/objections/api";
import type { TaxonomyMapping } from "@/growth/objections/types";
import { demoMappings, demoUpsertMapping } from "./localDemo";

const EDITOR =
  (typeof localStorage !== "undefined" &&
    localStorage.getItem("wfe_marketing_operator_id")) ||
  "marketing_operator-demo";

export function MappingAdmin() {
  const [rows, setRows] = useState<TaxonomyMapping[]>([]);
  const [selected, setSelected] = useState<TaxonomyMapping | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    try {
      try {
        setRows((await listMappings()).mappings);
      } catch {
        setRows(await demoMappings());
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "load failed");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (!selected) return;
    setErr(null);
    setMsg(null);
    try {
      let saved: TaxonomyMapping;
      try {
        saved = (
          await upsertMapping({
            ...selected,
            updated_by: EDITOR,
          })
        ).mapping;
      } catch {
        saved = await demoUpsertMapping({ ...selected, updated_by: EDITOR });
      }
      setMsg(`Saved ${saved.code}`);
      setSelected(saved);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "save failed");
    }
  };

  return (
    <div className="obj__panel" data-testid="mapping-admin">
      <p className="obj__meta">
        FR-O-03 mapping — editable by marketing_operator. Fear, evidence,
        approved asset refs, talk track.
      </p>
      <div className="obj__mapgrid">
        <div className="obj__mapcard">
          <strong>Codes</strong>
          {rows.map((r) => (
            <button
              key={r.code}
              type="button"
              className="obj__tap"
              data-selected={selected?.code === r.code}
              onClick={() => setSelected({ ...r })}
            >
              {r.label || r.code}
            </button>
          ))}
        </div>
        <div className="obj__mapcard">
          {!selected ? (
            <p className="obj__meta">Select a code to edit.</p>
          ) : (
            <>
              <strong>{selected.code}</strong>
              <label className="obj__meta">
                Underlying fear
                <textarea
                  rows={2}
                  value={selected.underlying_fear}
                  onChange={(e) =>
                    setSelected({ ...selected, underlying_fear: e.target.value })
                  }
                />
              </label>
              <label className="obj__meta">
                Evidence type
                <input
                  value={selected.evidence_type}
                  onChange={(e) =>
                    setSelected({ ...selected, evidence_type: e.target.value })
                  }
                />
              </label>
              <label className="obj__meta">
                Approved asset refs (comma-separated ids)
                <input
                  value={(selected.approved_asset_refs ?? []).join(", ")}
                  onChange={(e) =>
                    setSelected({
                      ...selected,
                      approved_asset_refs: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
              <label className="obj__meta">
                Counsellor talk track
                <textarea
                  rows={4}
                  value={selected.talk_track}
                  onChange={(e) =>
                    setSelected({ ...selected, talk_track: e.target.value })
                  }
                />
              </label>
              <button type="button" className="obj__btn" onClick={() => void save()}>
                Save mapping
              </button>
            </>
          )}
        </div>
      </div>
      {msg ? <p className="obj__ok">{msg}</p> : null}
      {err ? <p className="obj__err">{err}</p> : null}
    </div>
  );
}
