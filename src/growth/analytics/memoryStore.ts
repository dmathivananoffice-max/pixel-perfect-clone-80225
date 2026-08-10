import type { EventWriter } from "./events";
import type {
  DailyRollupRow,
  DropoffRow,
  FunnelEvent,
  HotQueueItem,
  LlmRollupRow,
} from "./types";
import { slaStatus } from "./sla";
import {
  buildDropoffRollup,
  buildFunnelDailyRollup,
  buildLlmRollup,
} from "./rollup";

export type ScoreRow = {
  lead_id: string;
  name: string | null;
  band: string;
  scored_at: string;
  dq_reason?: string | null;
  pathway?: string;
};

export function createMemoryAnalyticsStore(): EventWriter & {
  events: FunnelEvent[];
  scores: ScoreRow[];
  llm: { day: string; module: string; tokens_in: number; tokens_out: number; cost_eur: number }[];
  alerts: { severity: string; title: string; body: string; href?: string }[];
  rollups: DailyRollupRow[];
  dropoffs: DropoffRow[];
  llmRollups: LlmRollupRow[];
  insertFunnelEvent: EventWriter["insertFunnelEvent"];
  runRollup: (days?: number) => void;
  listHotQueue: (now?: Date) => HotQueueItem[];
  dqBreakdown: () => { reason: string; count: number }[];
  bandDistribution: () => Record<string, number>;
} {
  const events: FunnelEvent[] = [];
  const scores: ScoreRow[] = [];
  const llm: {
    day: string;
    module: string;
    tokens_in: number;
    tokens_out: number;
    cost_eur: number;
  }[] = [];
  const alerts: { severity: string; title: string; body: string; href?: string; code?: string }[] =
    [];
  let rollups: DailyRollupRow[] = [];
  let dropoffs: DropoffRow[] = [];
  let llmRollups: LlmRollupRow[] = [];

  return {
    events,
    scores,
    llm,
    alerts,
    get rollups() {
      return rollups;
    },
    get dropoffs() {
      return dropoffs;
    },
    get llmRollups() {
      return llmRollups;
    },
    async insertFunnelEvent(input) {
      const row: FunnelEvent = {
        id: crypto.randomUUID(),
        lead_id: input.lead_id ?? null,
        session_id: input.session_id ?? null,
        type: input.type,
        stage: input.stage,
        meta: input.meta ?? {},
        at: input.at ?? new Date().toISOString(),
      };
      events.push(row);
      return structuredClone(row);
    },
    runRollup(days = 14) {
      rollups = buildFunnelDailyRollup(events, days);
      dropoffs = buildDropoffRollup(events, days);
      llmRollups = buildLlmRollup(llm, days);
    },
    listHotQueue(now = new Date()) {
      return scores
        .filter((s) => s.band === "HOT")
        .map((s) => {
          const sla = slaStatus(s.scored_at, now);
          return {
            lead_id: s.lead_id,
            name: s.name,
            band: "HOT" as const,
            scored_at: s.scored_at,
            sla_deadline: sla.deadline,
            hours_remaining: sla.hours_remaining,
            breached: sla.breached,
          };
        })
        .sort((a, b) => a.hours_remaining - b.hours_remaining);
    },
    dqBreakdown() {
      const map = new Map<string, number>();
      for (const s of scores.filter((x) => x.band === "DISQUALIFIED")) {
        const reason = s.dq_reason ?? "unspecified";
        map.set(reason, (map.get(reason) ?? 0) + 1);
      }
      return [...map.entries()].map(([reason, count]) => ({ reason, count }));
    },
    bandDistribution() {
      const out: Record<string, number> = {
        HOT: 0,
        WARM: 0,
        NURTURE: 0,
        DISQUALIFIED: 0,
      };
      for (const s of scores) out[s.band] = (out[s.band] ?? 0) + 1;
      return out;
    },
  };
}
