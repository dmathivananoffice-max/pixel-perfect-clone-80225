/**
 * pg-boss job definitions for M3 scoring (FR-S-03, FR-S-04).
 * Worker registers these names; payloads are JSON-serialisable.
 */

export const SCORE_JOBS = {
  /** Recompute score for a lead after a triggering event. */
  RECOMPUTE: "growth.score.recompute",
  /** Side-effect: WARM→HOT (and any→HOT) counsellor task. */
  COUNSELLOR_TASK: "growth.counsellor_task",
  /** Side-effect: also enqueue briefing when becoming HOT. */
  COPILOT_BRIEFING: "growth.copilot_briefing",
  /**
   * Side-effect: any→DISQUALIFIED respectful DQ message.
   * Payload carries asset_ref only — message body lives in M11 assets later.
   */
  DQ_MESSAGE: "growth.dq_message",
} as const;

export type RecomputeTrigger =
  | "diagnostic_completion"
  | "contact_capture"
  | "new_message"
  | "booking_event"
  | "manual";

export type RecomputeJobPayload = {
  lead_id: string;
  trigger: RecomputeTrigger;
  branch?: string;
  answers?: Record<string, string>;
  session_id?: string;
};

export type CounsellorTaskPayload = {
  lead_id: string;
  from_band: string;
  to_band: "HOT";
  sla_business_hours: 4;
  score_id: string;
};

export type CopilotBriefingPayload = {
  lead_id: string;
  score_id: string;
};

export type DqMessagePayload = {
  lead_id: string;
  from_band: string;
  to_band: "DISQUALIFIED";
  /** Asset reference only — no body text here (FR-S-04 / G-2). */
  asset_ref: string;
  named_gaps: string[];
  alternative_pathway: string | null;
  exclude_from_retargeting: true;
};

/** Default DQ asset ref until M11 ships approved copy. */
export const DQ_MESSAGE_ASSET_REF = "asset:dq_respectful_v1";

export function bandTransitionJobs(
  fromBand: string | null,
  toBand: string,
  ctx: { lead_id: string; score_id: string; named_gaps?: string[]; alternative?: string | null },
): Array<{ name: string; payload: unknown }> {
  const jobs: Array<{ name: string; payload: unknown }> = [];

  if (toBand === "HOT" && fromBand !== "HOT") {
    jobs.push({
      name: SCORE_JOBS.COUNSELLOR_TASK,
      payload: {
        lead_id: ctx.lead_id,
        from_band: fromBand ?? "NONE",
        to_band: "HOT",
        sla_business_hours: 4,
        score_id: ctx.score_id,
      } satisfies CounsellorTaskPayload,
    });
    jobs.push({
      name: SCORE_JOBS.COPILOT_BRIEFING,
      payload: {
        lead_id: ctx.lead_id,
        score_id: ctx.score_id,
      } satisfies CopilotBriefingPayload,
    });
  }

  if (toBand === "DISQUALIFIED" && fromBand !== "DISQUALIFIED") {
    jobs.push({
      name: SCORE_JOBS.DQ_MESSAGE,
      payload: {
        lead_id: ctx.lead_id,
        from_band: fromBand ?? "NONE",
        to_band: "DISQUALIFIED",
        asset_ref: DQ_MESSAGE_ASSET_REF,
        named_gaps: ctx.named_gaps ?? [],
        alternative_pathway: ctx.alternative ?? null,
        exclude_from_retargeting: true,
      } satisfies DqMessagePayload,
    });
  }

  return jobs;
}
