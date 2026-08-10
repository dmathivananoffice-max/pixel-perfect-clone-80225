import { buildWaitlistCopy } from "./waitlistCopy";
import type {
  GovernorConfig,
  IntakeRecord,
  PathwayCapacityState,
} from "./types";

export const DEFAULT_GOVERNOR_CONFIG: GovernorConfig = {
  fill_threshold: 0.85,
  pathways: ["nursing-professional", "nursing-ausbildung"],
};

export function fillRatio(intake: Pick<IntakeRecord, "capacity" | "filled">): number {
  if (intake.capacity <= 0) return 1;
  return Math.min(1, intake.filled / intake.capacity);
}

/** Pick nearest intake on/after today (YYYY-MM-DD), then the one after that. */
export function pickNearestAndNext(
  intakes: IntakeRecord[],
  pathway: string,
  today = new Date().toISOString().slice(0, 10),
): { nearest: IntakeRecord | null; next: IntakeRecord | null } {
  const open = intakes
    .filter(
      (i) =>
        i.pathway === pathway &&
        (i.status === "OPEN" || i.status === "WAITLIST") &&
        i.batch_date >= today,
    )
    .sort((a, b) => a.batch_date.localeCompare(b.batch_date));
  return { nearest: open[0] ?? null, next: open[1] ?? null };
}

/**
 * Compute pathway capacity state from intakes.
 * At/above threshold → waitlist_mode + pathway_throttled + dashboard_flagged.
 */
export function computePathwayState(
  pathway: string,
  intakes: IntakeRecord[],
  config: GovernorConfig = DEFAULT_GOVERNOR_CONFIG,
  now = new Date(),
): PathwayCapacityState {
  const { nearest, next } = pickNearestAndNext(
    intakes,
    pathway,
    now.toISOString().slice(0, 10),
  );
  const threshold = config.fill_threshold;
  if (!nearest) {
    return {
      pathway,
      nearest_intake_id: null,
      next_intake_id: null,
      fill_ratio: 0,
      threshold,
      pathway_throttled: false,
      waitlist_mode: false,
      dashboard_flagged: false,
      waitlist_copy: null,
      nearest_batch_date: null,
      next_batch_date: null,
      computed_at: now.toISOString(),
      meta: { reason: "no_upcoming_intake" },
    };
  }

  const ratio = fillRatio(nearest);
  const over = ratio >= threshold;
  const waitlist_copy = over
    ? buildWaitlistCopy({
        nearest_batch_date: nearest.batch_date,
        next_batch_date: next?.batch_date ?? null,
      })
    : null;

  return {
    pathway,
    nearest_intake_id: nearest.id,
    next_intake_id: next?.id ?? null,
    fill_ratio: Number(ratio.toFixed(4)),
    threshold,
    pathway_throttled: over,
    waitlist_mode: over,
    dashboard_flagged: over,
    waitlist_copy,
    nearest_batch_date: nearest.batch_date,
    next_batch_date: next?.batch_date ?? null,
    computed_at: now.toISOString(),
    meta: {
      capacity: nearest.capacity,
      filled: nearest.filled,
      // Phase 2 readers: nurture engine + ads recommendations
      signals: {
        pathway_throttled: over,
        waitlist_mode: over,
      },
    },
  };
}

export function runGovernor(
  pathways: string[],
  intakes: IntakeRecord[],
  config: GovernorConfig = DEFAULT_GOVERNOR_CONFIG,
  now = new Date(),
): PathwayCapacityState[] {
  const list = pathways.length ? pathways : config.pathways;
  return list.map((p) => computePathwayState(p, intakes, config, now));
}
