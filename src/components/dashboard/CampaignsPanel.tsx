import type { CampaignFunnelJoin } from "@/growth/ads/types";
import { MetricTile } from "./MetricTile";

export function CampaignsPanel({
  rows,
  onDefine,
}: {
  rows: CampaignFunnelJoin[];
  onDefine: (key: string) => void;
}) {
  return (
    <div data-testid="campaigns-panel">
      <p className="dash__meta" style={{ marginTop: 0 }}>
        Campaigns sorted by cost per MQL, then spend. Read-only Meta sync —
        no pause or budget changes from this screen.
      </p>
      <div className="dash__tiles" style={{ marginBottom: "0.75rem" }}>
        <MetricTile
          glossaryKey="cost_per_mql"
          value={
            rows.find((r) => r.cost_per_mql != null)?.cost_per_mql != null
              ? `€${rows.find((r) => r.cost_per_mql != null)!.cost_per_mql}`
              : "—"
          }
          sub="Best campaign"
          onDefine={onDefine}
        />
        <MetricTile
          glossaryKey="spend"
          value={`€${rows.reduce((n, r) => n + r.spend_eur, 0).toFixed(0)}`}
          sub="Synced spend"
          onDefine={onDefine}
        />
      </div>

      <div className="dash__panel" style={{ overflowX: "auto" }}>
        <table className="dash__table" data-testid="campaigns-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>
                <button type="button" className="dash__th-btn" onClick={() => onDefine("spend")}>
                  Spend
                </button>
              </th>
              <th>
                <button type="button" className="dash__th-btn" onClick={() => onDefine("cost_per_lead")}>
                  €/lead
                </button>
              </th>
              <th>
                <button type="button" className="dash__th-btn" onClick={() => onDefine("cost_per_mql")}>
                  €/MQL
                </button>
              </th>
              <th>MQLs</th>
              <th>
                <button type="button" className="dash__th-btn" onClick={() => onDefine("ctr")}>
                  CTR
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.campaign_id} data-testid={`campaign-row-${r.campaign_external_id}`}>
                <td>
                  <div>{r.campaign_name}</div>
                  <div className="dash__meta">
                    {r.platform} · {r.status}
                  </div>
                  {r.no_qualified_leads_badge ? (
                    <button
                      type="button"
                      className="dash__badge"
                      data-testid="no-mql-badge"
                      onClick={() => onDefine("no_mql_badge")}
                    >
                      No qualified leads yet
                    </button>
                  ) : null}
                  {r.utm_lint ? (
                    <button
                      type="button"
                      className="dash__badge dash__badge--warn"
                      data-testid="utm-lint-badge"
                      onClick={() => onDefine("utm_lint")}
                    >
                      Missing tracking tags
                    </button>
                  ) : null}
                </td>
                <td>€{r.spend_eur.toFixed(2)}</td>
                <td>{r.cost_per_lead != null ? `€${r.cost_per_lead}` : "—"}</td>
                <td>{r.cost_per_mql != null ? `€${r.cost_per_mql}` : "—"}</td>
                <td>{r.mqls}</td>
                <td>{r.ctr}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
