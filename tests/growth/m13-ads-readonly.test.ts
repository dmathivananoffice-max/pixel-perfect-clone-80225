import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  FORBIDDEN_ADAPTER_METHODS,
  createGoogleReadAdapter,
  createMetaReadAdapter,
  createMemoryAdsStore,
  AdsReadService,
  mockGoogleSnapshot,
  lintUtmTemplate,
  generateUtmTemplate,
} from "../../src/growth/ads";
import { seedTenDiagnostics, ensureAdsSynced, ensureDashboardDemo } from "../../src/components/dashboard/localDemo";

async function listTsFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listTsFiles(p)));
    else if (/\.(ts|tsx|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe("M13 ads READ sync (FR-AD-01/02/04)", () => {
  test("Meta sync persists entities + metrics; Google skipped without token", async () => {
    const store = createMemoryAdsStore();
    const svc = new AdsReadService(
      store,
      [createMetaReadAdapter(), createGoogleReadAdapter()],
      { meta: "act_1001" },
    );
    const results = await svc.runHourlySync();
    const meta = results.find((r) => r.platform === "meta")!;
    const google = results.find((r) => r.platform === "google")!;
    expect(meta.entities).toBeGreaterThan(0);
    expect(meta.metrics).toBeGreaterThan(0);
    expect(meta.utm_alerts).toBeGreaterThan(0);
    expect(google.skipped_reason).toMatch(/TODO-GOOGLE-TOKEN/);
    expect(store.accounts.some((a) => a.platform === "meta")).toBe(true);
  });

  test("Google adapter activates only with token / test force; still read-only", async () => {
    const inactive = createGoogleReadAdapter();
    expect(inactive.activated).toBe(false);
    const active = createGoogleReadAdapter({
      forceActivateForTest: true,
      mockSnapshot: mockGoogleSnapshot(),
    });
    expect(active.activated).toBe(true);
    const store = createMemoryAdsStore();
    const svc = new AdsReadService(store, [active], { google: "cust_9001" });
    const [res] = await svc.runHourlySync();
    expect(res.platform).toBe("google");
    expect(res.entities).toBe(1);
    expect(res.skipped_reason).toBeUndefined();
  });

  test("UTM lint fires when active ad lacks required template", () => {
    const finding = lintUtmTemplate(
      {
        id: "1",
        external_id: "ad_x",
        name: "Broken",
        status: "ACTIVE",
        utm_template: null,
        landing_url: "https://example.com",
      },
      "meta",
    );
    expect(finding?.reason).toBe("missing_template");
    expect(generateUtmTemplate("meta", "camp_1")).toContain("utm_campaign=camp_1");
  });

  test("join Meta spend to funnel: cost per lead / MQL + no-MQL badge", async () => {
    await seedTenDiagnostics();
    await ensureAdsSynced();
    const { store, adsSvc } = ensureDashboardDemo();
    const rows = adsSvc.campaigns(store.events);
    const nursing = rows.find((r) => r.campaign_external_id === "camp_nursing_in");
    const zero = rows.find((r) => r.campaign_external_id === "camp_zero_mql");
    expect(nursing).toBeTruthy();
    expect(nursing!.leads).toBe(3);
    expect(nursing!.mqls).toBe(2);
    expect(nursing!.spend_eur).toBeGreaterThan(0);
    expect(nursing!.cost_per_mql).toBeTruthy();
    expect(zero!.no_qualified_leads_badge).toBe(true);
    expect(zero!.mqls).toBe(0);
    // broken UTM ad under nursing surfaces lint
    expect(nursing!.utm_lint?.external_id).toBe("ad_broken_utm");
    expect(adsSvc.utmAlerts().length).toBeGreaterThan(0);
  });

  test("home spend tile wired from sync (not placeholder)", async () => {
    await seedTenDiagnostics();
    await ensureAdsSynced();
    const { store, svc, adsSvc } = ensureDashboardDemo();
    const today = new Date().toISOString().slice(0, 10);
    const home = svc.home(
      "marketing_operator",
      { today: adsSvc.spendForDay(today), yesterday: 0 },
      adsSvc.utmAlerts(),
    );
    expect("error" in home).toBe(false);
    if ("error" in home) return;
    expect(home.today.spend).toBeGreaterThan(0);
    expect(home.alerts.some((a) => a.code === "UTM_MISSING")).toBe(true);
    expect(store.events.length).toBeGreaterThan(0);
  });

  test("adapters expose no mutation methods; codebase has zero ad-API write calls", async () => {
    const meta = createMetaReadAdapter();
    const google = createGoogleReadAdapter({ forceActivateForTest: true });
    for (const adapter of [meta, google]) {
      for (const verb of FORBIDDEN_ADAPTER_METHODS) {
        expect(
          (adapter as unknown as Record<string, unknown>)[verb],
        ).toBeUndefined();
      }
    }

    const adsDir = join(import.meta.dir, "../../src/growth/ads");
    const files = await listTsFiles(adsDir);
    // Executable write patterns only (comments/docs mentioning bans are OK)
    const patterns = [
      /\.mutate\s*\(/,
      /method:\s*["']POST["']/,
      /method:\s*["']PUT["']/,
      /method:\s*["']PATCH["']/,
      /method:\s*["']DELETE["']/,
      /scopes\s*[:=]\s*\[?[^\]]*ads_management/,
    ];
    const offenders: string[] = [];
    for (const f of files) {
      if (f.includes(".test.")) continue;
      const text = await readFile(f, "utf8");
      const code = text
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      for (const re of patterns) {
        if (re.test(code)) offenders.push(`${f} :: ${re}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
