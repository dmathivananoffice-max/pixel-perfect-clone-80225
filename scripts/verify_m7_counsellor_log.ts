/**
 * Simulate counsellor one-tap log (<10s) and confirm trends.
 * bun scripts/verify_m7_counsellor_log.ts
 */
import { createMemoryObjectionStore } from "../src/growth/objections/memoryStore";
import { ObjectionService } from "../src/growth/objections/service";

const store = createMemoryObjectionStore();
const svc = new ObjectionService(store);

console.log("1) Counsellor one-tap log (VISA-RISK)");
const t0 = performance.now();
const row = await svc.log({
  source: "counsellor",
  taxonomy_code: "VISA-RISK",
  logged_by: "counsellor-verify",
  pathway: "nursing-professional",
  verbatim: "Client worried about refusal",
});
const ms = performance.now() - t0;
console.log(`   logged id=${row.id} in ${ms.toFixed(1)}ms`);
if (ms >= 10_000) {
  console.error("FAIL: logging took >= 10s");
  process.exit(1);
}

console.log("2) Trends include the new row");
const trends = await svc.trends(8, "nursing-professional");
const hit = trends.find((t) => t.taxonomy_code === "VISA-RISK");
if (!hit || hit.objection_count < 1) {
  console.error("FAIL: VISA-RISK missing from trends", trends);
  process.exit(1);
}
console.log(
  `   week=${hit.week_start} code=${hit.taxonomy_code} count=${hit.objection_count} pathway=${hit.pathway}`,
);

console.log("\nOK: counsellor log <10s and visible in trend aggregation");
