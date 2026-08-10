import { auditFunnelCoverage } from "./coverage";
import {
  writeBandEvent,
  writeBookingEvent,
  writeCounsellorOutcome,
  writeFunnelEvent,
} from "./events";
import type { createMemoryAnalyticsStore } from "./memoryStore";
import type {
  DashboardRole,
  FunnelEventType,
  FunnelStageMetric,
  HomeMetrics,
} from "./types";
import { canView } from "./roles";

type Store = ReturnType<typeof createMemoryAnalyticsStore>;

const STAGE_ORDER: { stage: FunnelStageMetric["stage"]; types: string[]; label: string; key: string }[] =
  [
    { stage: "session", types: ["DIAG_START"], label: "Diagnostic starts", key: "diag_start" },
    {
      stage: "diagnostic",
      types: ["DIAG_COMPLETE"],
      label: "Diagnostic completes",
      key: "diag_complete",
    },
    { stage: "lead", types: ["LEAD_CREATED", "LEAD_RETURNED"], label: "Leads", key: "leads" },
    { stage: "score", types: ["BAND_ASSIGNED", "BAND_CHANGED"], label: "Scored", key: "mqls" },
    { stage: "booking", types: ["BOOKING_CREATED"], label: "Bookings", key: "bookings" },
    { stage: "attended", types: ["COUNSELLING_ATTENDED"], label: "Attended", key: "attended" },
    {
      stage: "application",
      types: ["APPLICATION_SUBMITTED"],
      label: "Applications",
      key: "application",
    },
    { stage: "paid", types: ["PAID"], label: "Paid", key: "paid" },
  ];

export class AnalyticsService {
  constructor(private store: Store) {}

  coverage() {
    return auditFunnelCoverage();
  }

  async emit(type: FunnelEventType, meta: Record<string, unknown> = {}, lead_id?: string) {
    return writeFunnelEvent(this.store, { type, lead_id, meta });
  }

  emitBand = (
    lead_id: string,
    band: string,
    prev?: string | null,
    pathway?: string,
  ) => writeBandEvent(this.store, { lead_id, band, prev_band: prev, pathway });

  emitBooking = (lead_id: string, pathway?: string) =>
    writeBookingEvent(this.store, { lead_id, pathway });

  emitOutcome = (
    lead_id: string,
    outcome: "COUNSELLING_ATTENDED" | "APPLICATION_SUBMITTED" | "PAID",
    logged_by: string,
    pathway?: string,
  ) =>
    writeCounsellorOutcome(this.store, {
      lead_id,
      outcome,
      logged_by,
      pathway,
    });

  runHourlyRollup(days = 14) {
    this.store.runRollup(days);
    return {
      funnel_rows: this.store.rollups.length,
      dropoff_rows: this.store.dropoffs.length,
      llm_rows: this.store.llmRollups.length,
    };
  }

  home(role: DashboardRole): HomeMetrics | { error: string } {
    if (!canView(role, "home") && !canView(role, "system_costs")) {
      return { error: "Your role cannot view Home. Open Leads instead." };
    }
    const today = new Date().toISOString().slice(0, 10);
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const count = (day: string, types: string[]) =>
      this.store.rollups
        .filter((r) => r.day === day && types.includes(r.event_type))
        .reduce((n, r) => n + r.event_count, 0);
    const mqlTypes = ["BAND_ASSIGNED", "BAND_CHANGED"];
    // MQL ≈ HOT+WARM band assigns today — approximate from scores if rollup empty
    const mqlFromScores = (day: string) =>
      this.store.scores.filter(
        (s) =>
          s.scored_at.slice(0, 10) === day &&
          (s.band === "HOT" || s.band === "WARM"),
      ).length;

    const llmToday = this.store.llmRollups
      .filter((r) => r.day === today)
      .reduce((n, r) => n + r.cost_eur, 0);
    const monthPrefix = today.slice(0, 7);
    const llmMonth = this.store.llmRollups
      .filter((r) => r.day.startsWith(monthPrefix))
      .reduce((n, r) => n + r.cost_eur, 0);

    return {
      today: {
        leads: count(today, ["LEAD_CREATED", "LEAD_RETURNED"]),
        mqls: count(today, mqlTypes) || mqlFromScores(today),
        bookings: count(today, ["BOOKING_CREATED"]),
        spend_placeholder: 0,
      },
      yesterday: {
        leads: count(y, ["LEAD_CREATED", "LEAD_RETURNED"]),
        mqls: count(y, mqlTypes) || mqlFromScores(y),
        bookings: count(y, ["BOOKING_CREATED"]),
        spend_placeholder: 0,
      },
      alerts: canView(role, "alerts") ? this.store.alerts : [],
      llm_today_eur: llmToday,
      llm_month_eur: llmMonth,
      envelope_eur: 300,
    };
  }

  funnel(filters?: { pathway?: string; source?: string }): {
    stages: FunnelStageMetric[];
    dropoff: { question_id: string; question_index: number; answered_count: number }[];
    by_pathway: Record<string, number>;
    by_source: Record<string, number>;
  } {
    let rows = this.store.rollups;
    if (filters?.pathway) rows = rows.filter((r) => r.pathway === filters.pathway);
    if (filters?.source) rows = rows.filter((r) => r.source === filters.source);

    const countTypes = (types: string[]) =>
      rows
        .filter((r) => types.includes(r.event_type))
        .reduce((n, r) => n + r.event_count, 0);

    const stages: FunnelStageMetric[] = [];
    let prev: number | null = null;
    for (const s of STAGE_ORDER) {
      const count = countTypes(s.types);
      stages.push({
        stage: s.stage,
        label: s.label,
        count,
        conversion_from_prev:
          prev && prev > 0 ? Math.round((count / prev) * 1000) / 10 : null,
        glossary_key: s.key,
      });
      prev = count || prev;
    }

    const dropMap = new Map<string, { question_id: string; question_index: number; answered_count: number }>();
    for (const d of this.store.dropoffs) {
      if (filters?.pathway && d.pathway !== filters.pathway) continue;
      const cur = dropMap.get(d.question_id);
      if (cur) cur.answered_count += d.answered_count;
      else {
        dropMap.set(d.question_id, {
          question_id: d.question_id,
          question_index: d.question_index,
          answered_count: d.answered_count,
        });
      }
    }

    const by_pathway: Record<string, number> = {};
    const by_source: Record<string, number> = {};
    for (const r of this.store.rollups.filter((x) => x.event_type === "DIAG_START")) {
      by_pathway[r.pathway] = (by_pathway[r.pathway] ?? 0) + r.event_count;
      by_source[r.source] = (by_source[r.source] ?? 0) + r.event_count;
    }

    return {
      stages,
      dropoff: [...dropMap.values()].sort((a, b) => a.question_index - b.question_index),
      by_pathway,
      by_source,
    };
  }

  leads() {
    return {
      bands: this.store.bandDistribution(),
      hot_queue: this.store.listHotQueue(),
      dq_reasons: this.store.dqBreakdown(),
    };
  }
}
