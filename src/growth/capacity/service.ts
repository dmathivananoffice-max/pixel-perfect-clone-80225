import { runGovernor, DEFAULT_GOVERNOR_CONFIG } from "./governor";
import { assertUrgencyTemplate } from "./scarcity";
import type { CapacityStore } from "./store";
import type {
  IntakeRecord,
  PathwayCapacityState,
  UrgencyCopyTemplate,
  WaitlistCta,
} from "./types";
import { buildOpenCtaCopy } from "./waitlistCopy";

export class CapacityService {
  constructor(private store: CapacityStore) {}

  listIntakes() {
    return this.store.listIntakes();
  }

  /**
   * Manual admin upsert.
   * INTEGRATION POINT (platform sync — Phase 2): replace/augment this write
   * path with a sync job that pulls pathway/batch_date/capacity/filled from
   * the Workforce Europe platform API and sets synced_at = now(). Keep
   * manual admin as override for break-glass capacity edits.
   */
  async upsertIntake(
    input: Parameters<CapacityStore["upsertIntake"]>[0],
  ): Promise<IntakeRecord> {
    if (input.capacity < 0) throw new Error("capacity must be >= 0");
    if (input.filled < 0) throw new Error("filled must be >= 0");
    if (input.filled > input.capacity) {
      throw new Error("filled cannot exceed capacity");
    }
    return this.store.upsertIntake(input);
  }

  /** Hourly governor: recompute all configured pathways and persist state. */
  async runHourlyGovernor(): Promise<PathwayCapacityState[]> {
    const [intakes, config] = await Promise.all([
      this.store.listIntakes(),
      this.store.getConfig(),
    ]);
    const states = runGovernor(
      config.pathways.length ? config.pathways : DEFAULT_GOVERNOR_CONFIG.pathways,
      intakes,
      config,
    );
    await this.store.savePathwayStates(states);
    return states;
  }

  getPathwayState(pathway: string) {
    return this.store.getPathwayState(pathway);
  }

  listPathwayStates() {
    return this.store.listPathwayStates();
  }

  /** Diagnostic / landing CTA resolver. */
  async resolveCta(pathway: string): Promise<WaitlistCta> {
    let state = await this.store.getPathwayState(pathway);
    if (!state) {
      const states = await this.runHourlyGovernor();
      state = states.find((s) => s.pathway === pathway) ?? null;
    }
    if (state?.waitlist_mode) {
      return {
        mode: "waitlist",
        label: "Join the waitlist",
        copy:
          state.waitlist_copy ??
          "The current intake is full — join the list for the next intake",
        intake_id: state.nearest_intake_id,
        pathway_throttled: state.pathway_throttled,
        dashboard_flagged: state.dashboard_flagged,
      };
    }
    return {
      mode: "open",
      label: "Continue",
      copy: buildOpenCtaCopy(state?.nearest_batch_date ?? null),
      intake_id: state?.nearest_intake_id ?? null,
      pathway_throttled: false,
      dashboard_flagged: Boolean(state?.dashboard_flagged),
    };
  }

  saveUrgencyTemplate(
    input: Omit<UrgencyCopyTemplate, "id" | "updated_at"> & { id?: string },
  ) {
    assertUrgencyTemplate(input);
    return this.store.saveUrgencyTemplate(input);
  }
}
