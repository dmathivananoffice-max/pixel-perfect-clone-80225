import type { FunnelEventType, FunnelStage } from "./types";

/**
 * FR-A-01 coverage map: every stage in the owned funnel must have a writer.
 * attended / application / paid are counsellor manual stubs for now.
 */
export const FUNNEL_CHAIN: {
  stage: FunnelStage;
  event_type: FunnelEventType;
  writer: string;
  status: "live" | "stub_manual";
}[] = [
  { stage: "session", event_type: "DIAG_START", writer: "diagnostic-session", status: "live" },
  {
    stage: "diagnostic",
    event_type: "DIAG_QUESTION_ANSWERED",
    writer: "diagnostic-session",
    status: "live",
  },
  { stage: "diagnostic", event_type: "DIAG_COMPLETE", writer: "diagnostic-session", status: "live" },
  { stage: "diagnostic", event_type: "DIAG_ABANDONED", writer: "mark_abandoned_*", status: "live" },
  { stage: "lead", event_type: "LEAD_CREATED", writer: "capture-lead", status: "live" },
  { stage: "lead", event_type: "LEAD_RETURNED", writer: "capture-lead", status: "live" },
  {
    stage: "lead",
    event_type: "DIAG_CONTACT_CAPTURED",
    writer: "diagnostic-session",
    status: "live",
  },
  { stage: "score", event_type: "BAND_ASSIGNED", writer: "analytics.events / scoring", status: "live" },
  { stage: "score", event_type: "BAND_CHANGED", writer: "analytics.events / scoring", status: "live" },
  { stage: "booking", event_type: "BOOKING_CREATED", writer: "analytics.events / booking", status: "live" },
  {
    stage: "attended",
    event_type: "COUNSELLING_ATTENDED",
    writer: "counsellor-outcomes (manual)",
    status: "stub_manual",
  },
  {
    stage: "application",
    event_type: "APPLICATION_SUBMITTED",
    writer: "counsellor-outcomes (manual)",
    status: "stub_manual",
  },
  {
    stage: "paid",
    event_type: "PAID",
    writer: "counsellor-outcomes (manual)",
    status: "stub_manual",
  },
];

export function auditFunnelCoverage(): {
  ok: boolean;
  missing_writers: string[];
  stubs: string[];
  live: string[];
} {
  const missing = FUNNEL_CHAIN.filter((c) => !c.writer).map((c) => c.event_type);
  return {
    ok: missing.length === 0,
    missing_writers: missing,
    stubs: FUNNEL_CHAIN.filter((c) => c.status === "stub_manual").map((c) => c.event_type),
    live: FUNNEL_CHAIN.filter((c) => c.status === "live").map((c) => c.event_type),
  };
}
