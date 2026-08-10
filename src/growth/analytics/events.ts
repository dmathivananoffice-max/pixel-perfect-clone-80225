import type { FunnelEvent, FunnelEventType, FunnelStage } from "./types";

export type EventWriter = {
  insertFunnelEvent(input: {
    lead_id?: string | null;
    session_id?: string | null;
    type: FunnelEventType | string;
    stage: FunnelStage | string;
    meta?: Record<string, unknown>;
    at?: string;
  }): Promise<FunnelEvent>;
};

const STAGE_FOR: Partial<Record<FunnelEventType, FunnelStage>> = {
  DIAG_START: "session",
  DIAG_QUESTION_ANSWERED: "diagnostic",
  DIAG_COMPLETE: "diagnostic",
  DIAG_ABANDONED: "diagnostic",
  DIAG_CONTACT_CAPTURED: "lead",
  LEAD_CREATED: "lead",
  LEAD_RETURNED: "lead",
  BAND_ASSIGNED: "score",
  BAND_CHANGED: "score",
  BOOKING_CREATED: "booking",
  COUNSELLING_ATTENDED: "attended",
  APPLICATION_SUBMITTED: "application",
  PAID: "paid",
};

export async function writeFunnelEvent(
  writer: EventWriter,
  input: {
    type: FunnelEventType;
    lead_id?: string | null;
    session_id?: string | null;
    meta?: Record<string, unknown>;
    at?: string;
  },
): Promise<FunnelEvent> {
  return writer.insertFunnelEvent({
    lead_id: input.lead_id ?? null,
    session_id: input.session_id ?? null,
    type: input.type,
    stage: STAGE_FOR[input.type] ?? "diagnostic",
    meta: input.meta ?? {},
    at: input.at,
  });
}

/** Called when a score band is first set or changes. */
export async function writeBandEvent(
  writer: EventWriter,
  input: {
    lead_id: string;
    band: string;
    prev_band?: string | null;
    pathway?: string;
    source?: string;
  },
) {
  const type: FunnelEventType = input.prev_band ? "BAND_CHANGED" : "BAND_ASSIGNED";
  return writeFunnelEvent(writer, {
    type,
    lead_id: input.lead_id,
    meta: {
      band: input.band,
      prev_band: input.prev_band ?? null,
      pathway: input.pathway,
      source: input.source,
    },
  });
}

export async function writeBookingEvent(
  writer: EventWriter,
  input: { lead_id: string; slot_id?: string; pathway?: string },
) {
  return writeFunnelEvent(writer, {
    type: "BOOKING_CREATED",
    lead_id: input.lead_id,
    meta: { slot_id: input.slot_id, pathway: input.pathway },
  });
}

/** Manual counsellor stubs for late-funnel stages. */
export async function writeCounsellorOutcome(
  writer: EventWriter,
  input: {
    lead_id: string;
    outcome: "COUNSELLING_ATTENDED" | "APPLICATION_SUBMITTED" | "PAID";
    pathway?: string;
    note?: string;
    logged_by: string;
  },
) {
  return writeFunnelEvent(writer, {
    type: input.outcome,
    lead_id: input.lead_id,
    meta: {
      pathway: input.pathway,
      note: input.note,
      logged_by: input.logged_by,
      stub_manual: true,
    },
  });
}
