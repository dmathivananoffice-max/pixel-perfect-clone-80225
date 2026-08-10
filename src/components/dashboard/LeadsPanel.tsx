import { MetricTile } from "./MetricTile";

type LeadsData = {
  bands: Record<string, number>;
  hot_queue: {
    lead_id: string;
    name: string | null;
    hours_remaining: number;
    breached: boolean;
    sla_deadline: string;
  }[];
  dq_reasons: { reason: string; count: number }[];
};

export function LeadsPanel({
  data,
  onDefine,
}: {
  data: LeadsData;
  onDefine: (key: string) => void;
}) {
  return (
    <div data-testid="leads-panel">
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.05rem" }}>Band distribution</h2>
      <div className="dash__tiles">
        <MetricTile glossaryKey="band_hot" value={data.bands.HOT ?? 0} onDefine={onDefine} />
        <MetricTile glossaryKey="band_warm" value={data.bands.WARM ?? 0} onDefine={onDefine} />
        <MetricTile
          glossaryKey="band_nurture"
          value={data.bands.NURTURE ?? 0}
          onDefine={onDefine}
        />
        <MetricTile
          glossaryKey="band_dq"
          value={data.bands.DISQUALIFIED ?? 0}
          onDefine={onDefine}
        />
      </div>

      <div className="dash__panel">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h3 style={{ marginTop: 0 }}>HOT queue</h3>
          <button
            type="button"
            style={{ border: 0, background: "transparent", color: "#0b4f6c", cursor: "pointer" }}
            onClick={() => onDefine("hot_sla")}
          >
            SLA: 4 business hours
          </button>
        </div>
        <table className="dash__table" data-testid="hot-queue">
          <thead>
            <tr>
              <th>Lead</th>
              <th>Hours left</th>
              <th>Deadline</th>
            </tr>
          </thead>
          <tbody>
            {data.hot_queue.length === 0 ? (
              <tr>
                <td colSpan={3}>No HOT leads right now.</td>
              </tr>
            ) : (
              data.hot_queue.map((h) => (
                <tr key={h.lead_id}>
                  <td>{h.name ?? h.lead_id.slice(0, 8)}</td>
                  <td className={h.breached ? "dash__breached" : "dash__ok"}>
                    {h.breached ? "BREACHED" : h.hours_remaining}
                  </td>
                  <td>{new Date(h.sla_deadline).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="dash__panel">
        <h3 style={{ marginTop: 0 }}>
          <button
            type="button"
            style={{ all: "unset", cursor: "pointer", fontWeight: 700 }}
            onClick={() => onDefine("dq_reasons")}
          >
            DQ reasons
          </button>
        </h3>
        <table className="dash__table">
          <tbody>
            {data.dq_reasons.length === 0 ? (
              <tr>
                <td>No disqualified leads in the sample.</td>
              </tr>
            ) : (
              data.dq_reasons.map((r) => (
                <tr key={r.reason}>
                  <td>{r.reason}</td>
                  <td>{r.count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
