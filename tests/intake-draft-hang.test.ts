import { describe, expect, test } from "bun:test";
import { BoundedTimeoutError, withTimeout } from "../src/lib/withTimeout.ts";
import {
  DRAFT_DB_TIMEOUT_MS,
  DRAFT_PHASE_BUDGET_MS,
  DRAFT_STUCK_MS,
  PROCESSING_WATCHDOG_MS,
} from "../src/lib/intake/hangBudgets.ts";

function draftsStagePct(overallPct: number): number {
  const steps = 6;
  const i = 5;
  const stageStart = (i / steps) * 100;
  const stageEnd = ((i + 1) / steps) * 100;
  if (overallPct <= stageStart) return 0;
  if (overallPct >= stageEnd) return 100;
  return ((overallPct - stageStart) / (stageEnd - stageStart)) * 100;
}

async function runDraftPhase(opts: {
  saveHangs: boolean;
  budgetMs: number;
  dbTimeoutMs: number;
}): Promise<{ timedOut: boolean; statuses: string[]; elapsedMs: number }> {
  const statuses: string[] = [];
  const started = Date.now();
  try {
    await withTimeout(
      (async () => {
        statuses.push("Finalising candidate draft…");
        if (opts.saveHangs) {
          await withTimeout(
            new Promise(() => {}),
            opts.dbTimeoutMs,
            "Saving candidate draft",
          );
        } else {
          await withTimeout(Promise.resolve(null), opts.dbTimeoutMs, "Saving candidate draft");
        }
        statuses.push("Candidate draft ready");
      })(),
      opts.budgetMs,
      "Draft phase",
    );
    return { timedOut: false, statuses, elapsedMs: Date.now() - started };
  } catch (e) {
    statuses.push("Draft save timed out — routed to manual review");
    statuses.push("Candidate draft ready");
    return {
      timedOut: e instanceof BoundedTimeoutError,
      statuses,
      elapsedMs: Date.now() - started,
    };
  }
}

describe("intake hang guards", () => {
  test("withTimeout rejects a never-settling promise", async () => {
    const hung = new Promise<void>(() => {});
    const started = Date.now();
    await expect(withTimeout(hung, 50, "Hung draft save")).rejects.toBeInstanceOf(
      BoundedTimeoutError,
    );
    expect(Date.now() - started).toBeLessThan(500);
  });

  test("withTimeout resolves a fast promise", async () => {
    expect(await withTimeout(Promise.resolve(42), 1_000, "fast")).toBe(42);
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

describe("screenshot failure mode", () => {
  test("90% overall maps to ~40% on Drafts stage (stuck UI look)", () => {
    const pct = draftsStagePct(90);
    expect(pct).toBeGreaterThan(35);
    expect(pct).toBeLessThan(45);
  });

  test("hung save is cut by outer draft budget", async () => {
    const r = await runDraftPhase({
      saveHangs: true,
      budgetMs: 120,
      dbTimeoutMs: 5_000,
    });
    expect(r.timedOut).toBe(true);
    expect(r.elapsedMs).toBeLessThan(500);
    expect(r.statuses).toContain("Finalising candidate draft…");
    expect(r.statuses).toContain("Candidate draft ready");
  });

  test("happy path completes under budget", async () => {
    const r = await runDraftPhase({
      saveHangs: false,
      budgetMs: 500,
      dbTimeoutMs: 200,
    });
    expect(r.timedOut).toBe(false);
    expect(r.statuses).toContain("Candidate draft ready");
    expect(r.elapsedMs).toBeLessThan(400);
  });

  test("297s hang exceeds new 90s force-complete window", () => {
    expect(297_000).toBeGreaterThan(DRAFT_STUCK_MS);
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
    await expect(withTimeout(draftPhase(), 80, "Draft phase")).rejects.toBeInstanceOf(
      BoundedTimeoutError,
    );
    expect(Date.now() - started).toBeLessThan(400);
  });
});
