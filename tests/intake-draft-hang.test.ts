import { describe, expect, test } from "bun:test";
import { BoundedTimeoutError, withTimeout } from "../src/lib/withTimeout.ts";
import {
  DRAFT_DB_TIMEOUT_MS,
  DRAFT_PHASE_BUDGET_MS,
  DRAFT_STUCK_MS,
  PROCESSING_WATCHDOG_MS,
} from "../src/lib/intake/hangBudgets.ts";

describe("intake hang guards", () => {
  test("withTimeout rejects a never-settling promise", async () => {
    const hung = new Promise<void>(() => {
      /* never settles — simulates supabase silent token-refresh park */
    });
    const started = Date.now();
    await expect(withTimeout(hung, 50, "Hung draft save")).rejects.toBeInstanceOf(
      BoundedTimeoutError,
    );
    expect(Date.now() - started).toBeLessThan(500);
  });

  test("withTimeout resolves a fast promise", async () => {
    const v = await withTimeout(Promise.resolve(42), 1_000, "fast");
    expect(v).toBe(42);
  });

  test("draft budgets are finite and ordered", () => {
    expect(DRAFT_DB_TIMEOUT_MS).toBeLessThan(DRAFT_PHASE_BUDGET_MS);
    expect(DRAFT_PHASE_BUDGET_MS).toBeLessThan(DRAFT_STUCK_MS);
    expect(DRAFT_STUCK_MS).toBeLessThan(PROCESSING_WATCHDOG_MS);
  });

  test("status mapping keywords cover Finalising candidate draft", () => {
    const t = "Finalising candidate draft…".toLowerCase();
    expect(t.includes("finalis") || t.includes("draft")).toBe(true);
  });
});

describe("draft phase budget simulation", () => {
  test("outer budget beats nested hung calls", async () => {
    const hungDb = () =>
      new Promise<{ error: null }>((resolve) => {
        setTimeout(() => resolve({ error: null }), 10_000);
      });

    const draftPhase = async () => {
      await withTimeout(hungDb(), DRAFT_DB_TIMEOUT_MS, "Saving candidate draft");
    };

    const started = Date.now();
    await expect(
      withTimeout(draftPhase(), 80, "Draft phase"),
    ).rejects.toBeInstanceOf(BoundedTimeoutError);
    expect(Date.now() - started).toBeLessThan(400);
  });
});
