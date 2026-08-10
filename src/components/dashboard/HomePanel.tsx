import type { HomeMetrics } from "@/growth/analytics/types";
import { MetricTile } from "./MetricTile";

export function HomePanel({
  data,
  onDefine,
}: {
  data: HomeMetrics;
  onDefine: (key: string) => void;
}) {
  return (
    <div data-testid="home-panel">
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.05rem" }}>Today</h2>
      <div className="dash__tiles">
        <MetricTile glossaryKey="leads" value={data.today.leads} onDefine={onDefine} />
        <MetricTile glossaryKey="mqls" value={data.today.mqls} onDefine={onDefine} />
        <MetricTile
          glossaryKey="bookings"
          value={data.today.bookings}
          onDefine={onDefine}
        />
        <MetricTile
          glossaryKey="spend"
          value={`€${data.today.spend_placeholder}`}
          sub="Placeholder"
          onDefine={onDefine}
        />
      </div>

      <h2 style={{ margin: "1rem 0 0.5rem", fontSize: "1.05rem" }}>Yesterday</h2>
      <div className="dash__tiles">
        <MetricTile
          glossaryKey="leads"
          value={data.yesterday.leads}
          onDefine={onDefine}
        />
        <MetricTile
          glossaryKey="mqls"
          value={data.yesterday.mqls}
          onDefine={onDefine}
        />
        <MetricTile
          glossaryKey="bookings"
          value={data.yesterday.bookings}
          onDefine={onDefine}
        />
      </div>

      <div className="dash__panel">
        <h3 style={{ marginTop: 0 }}>AI cost meter</h3>
        <div className="dash__tiles">
          <MetricTile
            glossaryKey="llm_cost"
            value={`€${data.llm_today_eur.toFixed(2)}`}
            sub="Today"
            onDefine={onDefine}
          />
          <MetricTile
            glossaryKey="envelope"
            value={`€${data.llm_month_eur.toFixed(2)} / €${data.envelope_eur}`}
            sub="Month vs envelope"
            onDefine={onDefine}
          />
        </div>
      </div>

      {data.alerts.length ? (
        <div className="dash__alerts" data-testid="alert-strip">
          {data.alerts.map((a, i) => (
            <div
              key={i}
              className="dash__alert"
              data-sev={a.severity}
            >
              <strong>{a.title}</strong>
              <div>{a.body}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
