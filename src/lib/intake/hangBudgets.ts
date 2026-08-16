/** Shared budgets for intake processing hang guards (UI + tests). */

/** If drafts/finalising stalls this long, force-complete so the UI never parks at 90%. */
export const DRAFT_STUCK_MS = 90_000;

/** Absolute ceiling for the whole processing screen. */
export const PROCESSING_WATCHDOG_MS = 12 * 60_000;

/** Hard ceiling for post-OCR draft DB work per candidate. */
export const DRAFT_PHASE_BUDGET_MS = 45_000;

/** Per-call timeout for draft/persist DB operations. */
export const DRAFT_DB_TIMEOUT_MS = 15_000;
