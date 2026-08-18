/**
 * Addendum B § M10 — cutover gate.
 *
 * Follow these steps in order. Do not lift the freeze unless every check
 * below is green AND readiness drift is exactly 0. If any check fails,
 * ROLL BACK with supabase/sql/sprint1_window_rollback.sql.
 * Do not patch forward inside the window.
 *
 *   0. Sprint 0 must already be applied. Capture snapshots. Parity M6 green.
 *   1. Day -3: apply 20260818010000_sprint1_phase1_unused_tables.sql
 *      Tables stay unused. No application wiring. Freeze stays down.
 *   2. Window start: broadcast migration_pending (Parity → session flush).
 *   3. Apply 20260818020000_sprint1_phase2_backfill.sql VERBATIM.
 *   4. Apply 20260818030000_sprint1_phase3_sync_triggers.sql
 *   5. bun scripts/sprint1_m10_gate.ts   ← this file
 *   6. GATE: all eight M6 checks pass AND M6.5 failingRows is empty.
 *   7. Only then may the freeze be lifted (out of scope for this sprint).
 *      Do not edit LEGACY_REQUIRED_SET here.
 *
 *   bun scripts/sprint1_m10_gate.ts
 */
import { runParityChecks } from "../src/lib/intake/parityChecks.ts";

const ROLLBACK = "ROLL BACK — apply supabase/sql/sprint1_window_rollback.sql. Do not patch forward inside the window.";

const result = await runParityChecks();
const failed = result.filter((c) => !c.pass);
const drift = result.find((c) => c.id === "m6_5_readiness_pct_unchanged");

for (const check of result) {
  const mark = check.pass ? "PASS" : "FAIL";
  console.log(`${mark}  ${check.title}  — ${check.summary}`);
  if (!check.pass) {
    for (const row of check.failingRows.slice(0, 20)) {
      console.log(`       ${row.id} — ${row.detail}`);
    }
  }
}

if (failed.length > 0) {
  console.error(`\nParity is not fully green (${failed.length} failed).`);
  console.error(ROLLBACK);
  process.exit(1);
}

if (!drift || !drift.pass || drift.failingRows.length !== 0) {
  console.error("\nReadiness drift is not exactly 0.");
  console.error(ROLLBACK);
  process.exit(1);
}

console.log("\nM10 gate: parity fully green, readiness drift exactly 0.");
console.log("Freeze stays in place until an operator lifts it. Do not edit LEGACY_REQUIRED_SET.");
