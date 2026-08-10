/**
 * Set intake to 90% filled; confirm Diagnostic CTA switches to waitlist.
 * bun scripts/verify_m9_waitlist_cta.ts
 */
import { CapacityService } from "../src/growth/capacity/service";
import {
  createMemoryCapacityStore,
  demoIntake,
} from "../src/growth/capacity/memoryStore";

function monthOffset(n: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

const store = createMemoryCapacityStore([
  demoIntake({
    id: "near",
    pathway: "nursing-professional",
    batch_date: monthOffset(1),
    capacity: 20,
    filled: 10,
    label: "Test nearest",
  }),
  demoIntake({
    id: "next",
    pathway: "nursing-professional",
    batch_date: monthOffset(2),
    capacity: 20,
    filled: 1,
    label: "Test next",
  }),
]);
const svc = new CapacityService(store);

console.log("1) Baseline CTA (50% fill)");
await svc.runHourlyGovernor();
const open = await svc.resolveCta("nursing-professional");
console.log("   mode=", open.mode, "label=", open.label);
if (open.mode !== "open") {
  console.error("FAIL: expected open at 50%");
  process.exit(1);
}

console.log("2) Set nearest intake to 90% filled (18/20)");
await svc.upsertIntake({
  id: "near",
  pathway: "nursing-professional",
  batch_date: monthOffset(1),
  capacity: 20,
  filled: 18,
  label: "Test nearest",
  status: "OPEN",
  updated_by: "verify",
});
const states = await svc.runHourlyGovernor();
const st = states.find((s) => s.pathway === "nursing-professional")!;
console.log(
  "   fill_ratio=",
  st.fill_ratio,
  "waitlist_mode=",
  st.waitlist_mode,
  "throttled=",
  st.pathway_throttled,
);

console.log("3) Diagnostic results CTA");
const cta = await svc.resolveCta("nursing-professional");
console.log("   mode=", cta.mode);
console.log("   label=", cta.label);
console.log("   copy=", cta.copy);

if (cta.mode !== "waitlist") {
  console.error("FAIL: CTA did not switch to waitlist");
  process.exit(1);
}
if (!/intake is full/i.test(cta.copy)) {
  console.error("FAIL: waitlist copy missing honest full-intake wording");
  process.exit(1);
}
if (!cta.pathway_throttled) {
  console.error("FAIL: pathway_throttled not set");
  process.exit(1);
}

console.log("\nOK: 90% fill → waitlist CTA + pathway_throttled for Phase 2 readers");
