/**
 * Manual verify: capture the same phone twice → one lead, two touches, LEAD_RETURNED.
 * Run: bun scripts/manual_capture_merge_verify.ts
 */
import { captureLead } from "../supabase/functions/_shared/lead/capture.ts";
import { MemoryLeadRepo } from "../supabase/functions/_shared/lead/memory_repo.ts";
import type { CaptureLeadRequest } from "../supabase/functions/_shared/lead/types.ts";

const phone = "+919811122233";

const base: CaptureLeadRequest = {
  phone,
  name: "Priya Nair",
  email: "priya@example.com",
  city: "Kochi",
  utm: {
    source: "meta",
    campaign: "nursing-kerala",
    landing_path: "/diagnostic/nursing",
  },
  click_ids: { fbclid: "fb.manual.1", gclid: "g.manual.1" },
  consent: {
    whatsapp: true,
    email: false,
    assessment_processing: true,
    consent_text_version: "consent-v1",
  },
};

const repo = new MemoryLeadRepo();

console.log("1) First capture…");
const first = await captureLead(
  repo,
  base,
  new Date("2026-08-09T09:00:00.000Z"),
);
console.log(JSON.stringify(first, null, 2));

console.log("\n2) Second capture (same phone, blank name, new city/email attempt)…");
const second = await captureLead(
  repo,
  {
    ...base,
    name: "",
    email: "priya.new@example.com",
    city: "Bengaluru",
    utm: { source: "google", landing_path: "/ads/nursing" },
    click_ids: { gclid: "g.manual.2" },
    consent: {
      whatsapp: true,
      email: true,
      assessment_processing: true,
      consent_text_version: "consent-v2",
    },
  },
  new Date("2026-08-09T10:00:00.000Z"),
);
console.log(JSON.stringify(second, null, 2));

const leads = [...repo.leads.values()];
const lead = leads[0];

console.log("\n=== ASSERTIONS ===");
const checks: Array<[string, boolean]> = [
  ["first event LEAD_CREATED", first.ok && first.result.event === "LEAD_CREATED"],
  ["second event LEAD_RETURNED", second.ok && second.result.event === "LEAD_RETURNED"],
  ["exactly one lead row", leads.length === 1],
  [
    "same lead_id both times",
    first.ok &&
      second.ok &&
      first.result.lead_id === second.result.lead_id,
  ],
  ["name not blanked (still Priya Nair)", lead?.name === "Priya Nair"],
  ["email not overwritten", lead?.email === "priya@example.com"],
  ["city not overwritten", lead?.city === "Kochi"],
  ["original gclid kept", lead?.click_ids.gclid === "g.manual.1"],
  ["two touch history rows", repo.touches.length === 2],
  [
    "funnel LEAD_CREATED then LEAD_RETURNED",
    repo.funnel.map((f) => f.type).join(",") === "LEAD_CREATED,LEAD_RETURNED",
  ],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
  if (!ok) failed++;
}

console.log("\nLead record:");
console.log(JSON.stringify(lead, null, 2));
console.log(`\nTouch count: ${repo.touches.length}`);
console.log(`Lead count: ${leads.length}`);

if (failed > 0) {
  console.error(`\nFAILED ${failed} check(s)`);
  process.exit(1);
}
console.log("\nOK: same phone captured twice → merged, not duplicated");
