/**
 * Read-only ads adapter contract (FR-AD-01).
 *
 * CRITICAL (C-05 / Phase 1): this interface exposes ONLY fetch/list methods.
 * There is no create, update, pause, resume, or budget mutation surface.
 * Phase 2 executor lives in a separate package and is not imported here.
 */
import type { RemoteAccountSnapshot } from "./types";

export type AdsReadAdapter = {
  readonly platform: "meta" | "google";
  /** True when credentials allow a live read sync. */
  readonly activated: boolean;
  /** Human-readable skip reason when not activated (e.g. Google token). */
  readonly inactiveReason?: string;
  /**
   * Pull entities + daily metrics for the lookback window.
   * Implementations must use HTTP GET (or platform read endpoints) only.
   */
  fetchAccountSnapshot(opts: {
    accountExternalId: string;
    lookbackDays: number;
  }): Promise<RemoteAccountSnapshot>;
};

/** Guard used in tests: adapter object keys must never include write verbs. */
export const FORBIDDEN_ADAPTER_METHODS = [
  "create",
  "update",
  "pause",
  "resume",
  "delete",
  "mutate",
  "setBudget",
  "updateBudget",
  "createCampaign",
  "updateCampaign",
  "pauseCampaign",
  "uploadConversion",
] as const;
