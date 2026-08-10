import type { DailyRollupRow, DropoffRow, FunnelEvent, LlmRollupRow } from "./types";

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** In-memory / test rollup — mirrors SQL refresh_funnel_daily_rollup. */
export function buildFunnelDailyRollup(
  events: FunnelEvent[],
  days = 14,
): DailyRollupRow[] {
  const cutoff = Date.now() - (days - 1) * 86400000;
  const map = new Map<string, DailyRollupRow>();
  for (const fe of events) {
    if (new Date(fe.at).getTime() < cutoff) continue;
    const pathway = String(fe.meta.pathway ?? "unknown");
    const source = String(fe.meta.source ?? "unknown");
    const key = `${dayKey(fe.at)}|${fe.stage}|${fe.type}|${pathway}|${source}`;
    const cur = map.get(key);
    if (cur) cur.event_count += 1;
    else {
      map.set(key, {
        day: dayKey(fe.at),
        stage: fe.stage,
        event_type: fe.type,
        pathway,
        source,
        event_count: 1,
        cost_eur: 0,
      });
    }
  }
  return [...map.values()];
}

export function buildDropoffRollup(events: FunnelEvent[], days = 14): DropoffRow[] {
  const cutoff = Date.now() - (days - 1) * 86400000;
  const map = new Map<string, DropoffRow>();
  for (const fe of events) {
    if (fe.type !== "DIAG_QUESTION_ANSWERED") continue;
    if (new Date(fe.at).getTime() < cutoff) continue;
    const pathway = String(fe.meta.pathway ?? "unknown");
    const question_id = String(fe.meta.question_id ?? "unknown");
    const question_index = Number(fe.meta.question_index ?? 0);
    const key = `${dayKey(fe.at)}|${pathway}|${question_id}`;
    const cur = map.get(key);
    if (cur) cur.answered_count += 1;
    else {
      map.set(key, {
        day: dayKey(fe.at),
        pathway,
        question_id,
        question_index,
        answered_count: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.question_index - b.question_index);
}

export function buildLlmRollup(
  rows: { day: string; module: string; tokens_in: number; tokens_out: number; cost_eur: number }[],
  days = 14,
): LlmRollupRow[] {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1));
  const cut = cutoff.toISOString().slice(0, 10);
  const map = new Map<string, LlmRollupRow>();
  for (const r of rows) {
    if (r.day < cut) continue;
    const key = `${r.day}|${r.module}`;
    const cur = map.get(key);
    if (cur) {
      cur.tokens_in += r.tokens_in;
      cur.tokens_out += r.tokens_out;
      cur.cost_eur += r.cost_eur;
    } else map.set(key, { ...r });
  }
  return [...map.values()];
}
