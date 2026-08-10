/**
 * Seed 10 diagnostics; print funnel drop-offs; assert glossary coverage.
 * bun scripts/verify_m8_dashboard_funnel.ts
 */
import { allGlossaryKeys, getGlossary } from "../src/growth/analytics/glossary";
import { seedTenDiagnostics } from "../src/components/dashboard/localDemo";

// Force a clean seed in this process
const svc = await seedTenDiagnostics();
const funnel = svc.funnel();
const home = svc.home("marketing_operator");
const leads = svc.leads();
const coverage = svc.coverage();

console.log("Coverage", coverage);
console.log("\nFunnel stages:");
for (const s of funnel.stages) {
  const def = getGlossary(s.glossary_key);
  console.log(
    `  ${s.label}: ${s.count}` +
      (s.conversion_from_prev != null ? ` (${s.conversion_from_prev}% from prev)` : "") +
      ` — tap def: "${def.plain.slice(0, 60)}…"`,
  );
}

console.log("\nQuestion drop-off:");
for (const d of funnel.dropoff) {
  console.log(`  ${d.question_id} (idx ${d.question_index}): ${d.answered_count} answers`);
}

if (funnel.stages[0]!.count !== 10) {
  console.error("FAIL: expected 10 diagnostic starts");
  process.exit(1);
}
const q0 = funnel.dropoff.find((d) => d.question_id === "q0")?.answered_count ?? 0;
const last = funnel.dropoff[funnel.dropoff.length - 1]?.answered_count ?? 0;
if (!(q0 > last)) {
  console.error("FAIL: drop-off not decreasing", funnel.dropoff);
  process.exit(1);
}

const keys = ["leads", "mqls", "bookings", "diag_start", "hot_sla", "llm_cost"];
for (const k of keys) {
  if (!allGlossaryKeys().includes(k)) {
    console.error("FAIL: missing glossary key", k);
    process.exit(1);
  }
}

if ("error" in home) {
  console.error("FAIL home", home);
  process.exit(1);
}
console.log("\nHome today leads/mqls/bookings", home.today);
console.log("HOT queue", leads.hot_queue.length, "DQ reasons", leads.dq_reasons);

console.log("\nOK: 10 diagnostics seeded; funnel drop-offs visible; metrics have definitions");
