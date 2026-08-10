import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MetricTile } from "./MetricTile";

type FunnelData = {
  stages: {
    stage: string;
    label: string;
    count: number;
    conversion_from_prev: number | null;
    glossary_key: string;
  }[];
  dropoff: { question_id: string; question_index: number; answered_count: number }[];
  by_pathway: Record<string, number>;
  by_source: Record<string, number>;
};

export function FunnelPanel({
  data,
  onDefine,
}: {
  data: FunnelData;
  onDefine: (key: string) => void;
}) {
  return (
    <div data-testid="funnel-panel">
      <p className="dash__meta">
        Stage counts and conversion from the previous step. Tap any number for a
        plain-English definition.
      </p>
      <div className="dash__tiles">
        {data.stages.map((s) => (
          <MetricTile
            key={s.stage}
            glossaryKey={s.glossary_key}
            value={s.count}
            sub={
              s.conversion_from_prev == null
                ? undefined
                : `${s.conversion_from_prev}% from previous`
            }
            onDefine={onDefine}
          />
        ))}
      </div>

      <div className="dash__panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
          <h3 style={{ margin: 0 }}>Diagnostic question drop-off</h3>
          <button
            type="button"
            className="dash__tile-hint"
            style={{ border: 0, background: "transparent", cursor: "pointer" }}
            onClick={() => onDefine("diag_dropoff")}
          >
            What is this?
          </button>
        </div>
        <div className="dash__chart" data-testid="dropoff-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.dropoff}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d5dde6" />
              <XAxis dataKey="question_id" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="answered_count" fill="#0b4f6c" name="Answers" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="dash__panel">
        <h3 style={{ marginTop: 0 }}>
          <button
            type="button"
            style={{ all: "unset", cursor: "pointer", fontWeight: 700 }}
            onClick={() => onDefine("pathway")}
          >
            Starts by pathway
          </button>
        </h3>
        <table className="dash__table">
          <tbody>
            {Object.entries(data.by_pathway).map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td>
                  <button type="button" onClick={() => onDefine("diag_start")}>
                    {v}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>
          <button
            type="button"
            style={{ all: "unset", cursor: "pointer", fontWeight: 700 }}
            onClick={() => onDefine("source")}
          >
            Starts by source
          </button>
        </h3>
        <table className="dash__table">
          <tbody>
            {Object.entries(data.by_source).map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td>
                  <button type="button" onClick={() => onDefine("diag_start")}>
                    {v}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
