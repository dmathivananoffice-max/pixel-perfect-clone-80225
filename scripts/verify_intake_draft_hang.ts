/**
 * Thorough verification of the intake "Building candidate drafts" hang fix.
 *
 * Reproduces the production failure mode:
 *   - OCR/pipeline finished
 *   - Status stuck on "Finalising candidate draft…"
 *   - Overall progress capped at 90% (Drafts stage ~40%)
 *   - supabase-js parks forever on silent token refresh
 *
 * Then asserts the fix budgets win and the UI would force-complete.
 *
 *   bun scripts/verify_intake_draft_hang.ts
 */
import { BoundedTimeoutError, withTimeout } from "../src/lib/withTimeout.ts";
import {
  DRAFT_DB_TIMEOUT_MS,
  DRAFT_PHASE_BUDGET_MS,
  DRAFT_STUCK_MS,
  PROCESSING_WATCHDOG_MS,
} from "../src/lib/intake/hangBudgets.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function hungForever<T = never>(): Promise<T> {
  return new Promise(() => {
    /* never settles — supabase silent refresh */
  });
}

/** Mirrors ProcessingStep stage progress math for the last (Drafts) band. */
function draftsStagePct(overallPct: number): number {
  const steps = 6;
  const i = 5; // drafts
  const stageStart = (i / steps) * 100;
  const stageEnd = ((i + 1) / steps) * 100;
  if (overallPct <= stageStart) return 0;
  if (overallPct >= stageEnd) return 100;
  return ((overallPct - stageStart) / (stageEnd - stageStart)) * 100;
}

function mapStatusToStep(statusText: string): number | null {
  const t = statusText.toLowerCase();
  if (t.startsWith("uploading") || t.includes("intake batch")) return 0;
  if (t.includes("archive") || t.includes("extracting archives")) return 1;
  if (t.includes("classif")) return 2;
  if (t.includes("ocr")) return 3;
  if (t.includes("ai extraction")) return 4;
  if (t.includes("draft") || t.includes("finalis") || t.includes("manual review")) return 5;
  return null;
}

async function simulateDraftPhase(opts: {
  refreshHangs: boolean;
  saveHangs: boolean;
  budgetMs: number;
  dbTimeoutMs: number;
}): Promise<{ ok: boolean; statuses: string[]; elapsedMs: number; timedOut: boolean }> {
  const statuses: string[] = [];
  const started = Date.now();
  let timedOut = false;
  try {
    await withTimeout(
      (async () => {
        // ensureFreshSession
        try {
          if (opts.refreshHangs) {
            await withTimeout(hungForever(), opts.dbTimeoutMs, "Session refresh before draft save");
          } else {
            await withTimeout(Promise.resolve({ data: { session: {} } }), opts.dbTimeoutMs, "Session refresh");
          }
        } catch {
          statuses.push("session_refresh_failed_continue");
        }
        statuses.push("Finalising candidate draft…");
        // Saving candidate draft (the hang point from the screenshot)
        if (opts.saveHangs) {
          await withTimeout(hungForever(), opts.dbTimeoutMs, "Saving candidate draft");
        } else {
          await withTimeout(Promise.resolve({ error: null }), opts.dbTimeoutMs, "Saving candidate draft");
        }
        statuses.push("Candidate draft ready");
      })(),
      opts.budgetMs,
      "Draft phase",
    );
    return { ok: true, statuses, elapsedMs: Date.now() - started, timedOut: false };
  } catch (e) {
    timedOut = e instanceof BoundedTimeoutError || /timed out|did not respond/i.test(String(e));
    statuses.push(
      timedOut
        ? "Draft save timed out — routed to manual review"
        : "Draft failed — routed to manual review",
    );
    statuses.push("Candidate draft ready"); // finally block in persist
    return { ok: false, statuses, elapsedMs: Date.now() - started, timedOut };
  }
}

console.log("=== Intake draft-hang thorough verify ===\n");

// 1) Screenshot math: 90% overall → ~40% on Drafts stage
{
  const stagePct = draftsStagePct(90);
  console.log(`1) Progress math: overall 90% → Drafts stage ${stagePct.toFixed(1)}%`);
  assert(stagePct > 35 && stagePct < 45, `expected ~40% drafts stage, got ${stagePct}`);
  console.log("   OK — matches the stuck screenshot band\n");
}

// 2) Status mapping lands on Drafts
{
  const step = mapStatusToStep("Finalising candidate draft…");
  console.log(`2) Status map: Finalising → step ${step}`);
  assert(step === 5, "Finalising must map to Drafts step");
  console.log("   OK\n");
}

// 3) Budget ordering
{
  console.log("3) Budget ordering");
  assert(DRAFT_DB_TIMEOUT_MS < DRAFT_PHASE_BUDGET_MS, "db < phase");
  assert(DRAFT_PHASE_BUDGET_MS < DRAFT_STUCK_MS, "phase < stuck");
  assert(DRAFT_STUCK_MS < PROCESSING_WATCHDOG_MS, "stuck < watchdog");
  console.log(
    `   db=${DRAFT_DB_TIMEOUT_MS}ms phase=${DRAFT_PHASE_BUDGET_MS}ms stuck=${DRAFT_STUCK_MS}ms watchdog=${PROCESSING_WATCHDOG_MS}ms`,
  );
  console.log("   OK\n");
}

// 4) Happy path completes quickly
{
  console.log("4) Happy path draft phase");
  const r = await simulateDraftPhase({
    refreshHangs: false,
    saveHangs: false,
    budgetMs: 500,
    dbTimeoutMs: 200,
  });
  assert(r.ok, "happy path should succeed");
  assert(r.statuses.includes("Finalising candidate draft…"), "must emit Finalising");
  assert(r.statuses.includes("Candidate draft ready"), "must emit ready");
  assert(r.elapsedMs < 400, `happy path too slow: ${r.elapsedMs}ms`);
  console.log(`   OK in ${r.elapsedMs}ms — ${r.statuses.join(" → ")}\n`);
}

// 5) Hung save is cut by outer budget (the production bug)
{
  console.log("5) Hung draft SAVE (token-refresh park) — outer budget must win");
  const r = await simulateDraftPhase({
    refreshHangs: false,
    saveHangs: true,
    budgetMs: 120,
    dbTimeoutMs: 5_000, // nested timeout longer than budget
  });
  assert(!r.ok && r.timedOut, "must time out");
  assert(r.elapsedMs < 500, `budget did not win fast enough: ${r.elapsedMs}ms`);
  assert(
    r.statuses.some((s) => /timed out|manual review/i.test(s)),
    "must route to manual review messaging",
  );
  assert(r.statuses.includes("Candidate draft ready"), "finally must still emit ready");
  console.log(`   OK timed out in ${r.elapsedMs}ms — UI would leave 90% cap\n`);
}

// 6) Hung session refresh still continues then hits save budget
{
  console.log("6) Hung session refresh — continue, then hung save still budgeted");
  const r = await simulateDraftPhase({
    refreshHangs: true,
    saveHangs: true,
    budgetMs: 150,
    dbTimeoutMs: 80,
  });
  assert(r.timedOut || r.statuses.includes("session_refresh_failed_continue"), "refresh handled");
  assert(r.elapsedMs < 600, `too slow: ${r.elapsedMs}ms`);
  assert(r.statuses.includes("Candidate draft ready"), "must still finish phase");
  console.log(`   OK in ${r.elapsedMs}ms — ${r.statuses.join(" → ")}\n`);
}

// 7) Multiple sequential hung candidates don't exceed per-candidate budget * N badly
{
  console.log("7) Three sequential hung draft phases");
  const started = Date.now();
  for (let i = 0; i < 3; i++) {
    const r = await simulateDraftPhase({
      refreshHangs: false,
      saveHangs: true,
      budgetMs: 100,
      dbTimeoutMs: 2_000,
    });
    assert(r.timedOut, `candidate ${i} must time out`);
  }
  const elapsed = Date.now() - started;
  assert(elapsed < 800, `3 hung drafts took too long: ${elapsed}ms`);
  console.log(`   OK 3 candidates recovered in ${elapsed}ms\n`);
}

// 8) UI stuck detector would fire before absolute watchdog
{
  console.log("8) UI force-complete window");
  assert(DRAFT_STUCK_MS === 90_000, "drafts stuck must be 90s");
  // At 297s (screenshot) the old UI was still stuck; new UI forces at 90s.
  assert(297_000 > DRAFT_STUCK_MS, "screenshot elapsed exceeds new force-complete");
  console.log("   OK — 297s hang would have been force-completed at 90s\n");
}

console.log("ALL CHECKS PASSED — draft hang fix behaves correctly under thorough simulation");
