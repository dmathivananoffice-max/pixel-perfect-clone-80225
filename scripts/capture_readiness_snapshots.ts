/**
 * Capture a readiness_snapshots row for every candidate (Sprint 0).
 *
 *   bun scripts/capture_readiness_snapshots.ts
 *
 * Uses the same computeReadinessPct() as the admin Parity screen.
 */
import { captureReadinessSnapshots } from "../src/lib/intake/readinessSnapshots.ts";

const result = await captureReadinessSnapshots();
if (result.error) {
  console.error("CAPTURE FAILED:", result.error);
  console.error(
    "Apply supabase/migrations/20260818000000_sprint0_safety_net.sql first, then re-run.",
  );
  process.exit(1);
}
console.log(`Captured ${result.inserted} readiness snapshot(s).`);
for (const row of result.rows.slice(0, 20)) {
  console.log(
    `  ${row.candidate_id}  pct=${row.readiness_pct}  v=${row.schema_version}  ${row.required_satisfied}/${row.required_total}`,
  );
}
if (result.rows.length > 20) console.log(`  … ${result.rows.length - 20} more`);
