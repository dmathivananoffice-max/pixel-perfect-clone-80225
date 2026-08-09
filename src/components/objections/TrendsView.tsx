import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchTrends } from "@/growth/objections/api";
import type { TrendRow } from "@/growth/objections/types";
import { demoTrends } from "./localDemo";

type Props = { refreshKey?: number };

export function TrendsView({ refreshKey = 0 }: Props) {
  const [rows, setRows] = useState<TrendRow[]>([]);
  const [pathway, setPathway] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        try {
          const res = await fetchTrends(8, pathway || undefined);
          setRows(res.trends);
        } catch {
          setRows(await demoTrends(8, pathway || undefined));
        }
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "trends failed");
      }
    })();
  }, [pathway, refreshKey]);

  const byWeekCode = useMemo(() => {
    const weeks = [...new Set(rows.map((r) => r.week_start))].sort();
    const codes = [...new Set(rows.map((r) => r.taxonomy_code))].sort();
    return weeks.map((week) => {
      const point: Record<string, string | number> = { week };
      for (const code of codes) {
        point[code] = rows
          .filter((r) => r.week_start === week && r.taxonomy_code === code)
          .reduce((n, r) => n + Number(r.objection_count), 0);
      }
      return point;
    });
  }, [rows]);

  const codes = useMemo(
    () => [...new Set(rows.map((r) => r.taxonomy_code))].sort(),
    [rows],
  );

  const palette = ["#1f5c45", "#2f6f8f", "#8a5a2b", "#6b3fa0", "#b33b3b", "#3b6b3b", "#445566", "#9a6b2f", "#2a6a6a", "#6a4a6a"];

  return (
    <div className="obj__panel" data-testid="trends-view">
      <div className="obj__row" style={{ marginTop: 0 }}>
        <label>
          Pathway filter
          <select
            value={pathway}
            onChange={(e) => setPathway(e.target.value)}
            data-testid="trends-pathway"
          >
            <option value="">All pathways</option>
            <option value="nursing-professional">nursing-professional</option>
            <option value="nursing-ausbildung">nursing-ausbildung</option>
            <option value="unknown">unknown</option>
          </select>
        </label>
      </div>
      {error ? <p className="obj__err">{error}</p> : null}
      <div className="obj__chart" data-testid="trends-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byWeekCode}>
            <CartesianGrid strokeDasharray="3 3" stroke="#c9d4cc" />
            <XAxis dataKey="week" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {codes.map((code, i) => (
              <Bar
                key={code}
                dataKey={code}
                stackId="a"
                fill={palette[i % palette.length]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="obj__table" data-testid="trends-table">
        <thead>
          <tr>
            <th>Week</th>
            <th>Code</th>
            <th>Pathway</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4}>No objections yet</td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={`${r.week_start}-${r.taxonomy_code}-${r.pathway}-${i}`}>
                <td>{r.week_start}</td>
                <td>{r.taxonomy_code}</td>
                <td>{r.pathway}</td>
                <td>{r.objection_count}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
