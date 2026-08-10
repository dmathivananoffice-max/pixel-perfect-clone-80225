/**
 * Sync Meta fixture, join to 10 seeded diagnostics, break-UTM alert, mutation scan.
 * bun scripts/verify_m13_ads_readonly.ts
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ensureAdsSynced,
  ensureDashboardDemo,
  seedTenDiagnostics,
} from "../src/components/dashboard/localDemo";
import { FORBIDDEN_ADAPTER_METHODS, createMetaReadAdapter, createGoogleReadAdapter } from "../src/growth/ads";

await seedTenDiagnostics();
const ads = await ensureAdsSynced();
const { store, svc } = ensureDashboardDemo();
const today = new Date().toISOString().slice(0, 10);
const rows = ads.campaigns(store.events);
const home = svc.home(
  "marketing_operator",
  { today: ads.spendForDay(today), yesterday: 0 },
  ads.utmAlerts(),
);

console.log("Sync spend today €", ads.spendForDay(today));
console.log("\nCampaigns (cost/MQL sort):");
for (const r of rows) {
  console.log(
    `  ${r.campaign_name}: spend €${r.spend_eur} | leads ${r.leads} | MQLs ${r.mqls}` +
      ` | €/MQL ${r.cost_per_mql ?? "—"}` +
      (r.no_qualified_leads_badge ? " | BADGE: no qualified leads yet" : "") +
      (r.utm_lint ? ` | UTM LINT: ${r.utm_lint.external_id}` : ""),
  );
}

if ("error" in home) {
  console.error("FAIL home", home.error);
  process.exit(1);
}

console.log("\nHome today", {
  leads: home.today.leads,
  mqls: home.today.mqls,
  bookings: home.today.bookings,
  spend: home.today.spend,
});
console.log(
  "UTM alerts",
  home.alerts.filter((a) => a.code?.startsWith("UTM")),
);

const nursing = rows.find((r) => r.campaign_external_id === "camp_nursing_in");
const zero = rows.find((r) => r.campaign_external_id === "camp_zero_mql");
if (!nursing || nursing.leads < 1 || nursing.spend_eur <= 0) {
  console.error("FAIL: Meta campaign not joined to funnel numbers", nursing);
  process.exit(1);
}
if (!nursing.utm_lint) {
  console.error("FAIL: expected UTM lint on broken test ad");
  process.exit(1);
}
if (!zero?.no_qualified_leads_badge) {
  console.error("FAIL: expected no-MQL badge on high-spend zero-MQL campaign");
  process.exit(1);
}
if (home.today.spend <= 0) {
  console.error("FAIL: Home spend tile still empty");
  process.exit(1);
}
if (!home.alerts.some((a) => a.code === "UTM_MISSING" || a.code === "UTM_MALFORMED")) {
  console.error("FAIL: UTM alert not on Home strip");
  process.exit(1);
}

// Mutation surface scan
for (const a of [createMetaReadAdapter(), createGoogleReadAdapter()]) {
  for (const verb of FORBIDDEN_ADAPTER_METHODS) {
    if ((a as unknown as Record<string, unknown>)[verb] != null) {
      console.error("FAIL: adapter exposes", verb);
      process.exit(1);
    }
  }
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const patterns = [
  /method:\s*["']POST["']/,
  /method:\s*["']PUT["']/,
  /method:\s*["']PATCH["']/,
  /method:\s*["']DELETE["']/,
  /\.mutate\s*\(/,
];
for (const f of await walk(join(import.meta.dir, "../src/growth/ads"))) {
  const text = await readFile(f, "utf8");
  const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const re of patterns) {
    if (re.test(code)) {
      console.error("FAIL: mutation-shaped code in", f, re);
      process.exit(1);
    }
  }
}

console.log("\nOK: Meta spend next to funnel; UTM lint alert fired; zero write scopes / mutation code");
console.log("write_scopes: none");
