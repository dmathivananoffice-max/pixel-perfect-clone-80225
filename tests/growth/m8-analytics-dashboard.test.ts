import { describe, expect, test } from "bun:test";
import { auditFunnelCoverage } from "../../src/growth/analytics/coverage";
import { allGlossaryKeys, getGlossary } from "../../src/growth/analytics/glossary";
import { createMemoryAnalyticsStore } from "../../src/growth/analytics/memoryStore";
import { canView } from "../../src/growth/analytics/roles";
import { AnalyticsService } from "../../src/growth/analytics/service";
import { addBusinessHours, slaStatus } from "../../src/growth/analytics/sla";
import { seedTenDiagnostics } from "../../src/components/dashboard/localDemo";

describe("M8 analytics + M15 dashboard shell", () => {
  test("funnel coverage audit has writers for every stage", () => {
    const c = auditFunnelCoverage();
    expect(c.ok).toBe(true);
    expect(c.stubs).toContain("COUNSELLING_ATTENDED");
    expect(c.stubs).toContain("APPLICATION_SUBMITTED");
    expect(c.stubs).toContain("PAID");
    expect(c.live).toContain("DIAG_START");
    expect(c.live).toContain("BAND_ASSIGNED");
  });

  test("glossary defines core metrics in plain English", () => {
    expect(allGlossaryKeys().length).toBeGreaterThan(10);
    expect(getGlossary("mqls").plain.toLowerCase()).toContain("hot");
    expect(getGlossary("hot_sla").plain).toMatch(/4 business-?hours?/i);
  });

  test("HOT SLA adds 4 business hours", () => {
    // Monday 10:00 UTC
    const start = "2026-08-10T10:00:00.000Z";
    const deadline = addBusinessHours(start, 4);
    expect(new Date(deadline).getUTCHours()).toBe(14);
    const ok = slaStatus(start, new Date("2026-08-10T11:00:00.000Z"));
    expect(ok.breached).toBe(false);
    const late = slaStatus(start, new Date("2026-08-10T16:00:00.000Z"));
    expect(late.breached).toBe(true);
  });

  test("role scopes: counsellor sees leads only", () => {
    expect(canView("counsellor", "leads")).toBe(true);
    expect(canView("counsellor", "home")).toBe(false);
    expect(canView("marketing_operator", "funnel")).toBe(true);
  });

  test("10 seeded diagnostics produce drop-off and stage counts", async () => {
    // reset module seed by using a fresh service path via seed helper once
    const svc = await seedTenDiagnostics();
    const funnel = svc.funnel();
    expect(funnel.stages.find((s) => s.stage === "session")!.count).toBe(10);
    expect(funnel.dropoff.length).toBeGreaterThan(1);
    // Later questions have fewer answers than q0
    const q0 = funnel.dropoff.find((d) => d.question_id === "q0")?.answered_count ?? 0;
    const q5 = funnel.dropoff.find((d) => d.question_id === "q5")?.answered_count ?? 0;
    expect(q0).toBeGreaterThan(q5);

    const home = svc.home("marketing_operator");
    expect("error" in home).toBe(false);
    if (!("error" in home)) {
      expect(home.today.leads + home.yesterday.leads).toBeGreaterThan(0);
    }

    const leads = svc.leads();
    expect(leads.bands.HOT).toBeGreaterThanOrEqual(1);
    expect(leads.hot_queue.length).toBeGreaterThanOrEqual(1);
  });

  test("manual counsellor outcomes write late-funnel events", async () => {
    const store = createMemoryAnalyticsStore();
    const svc = new AnalyticsService(store);
    const lead = crypto.randomUUID();
    await svc.emitOutcome(lead, "PAID", "counsellor-1", "nursing-professional");
    expect(store.events.some((e) => e.type === "PAID")).toBe(true);
    svc.runHourlyRollup();
    expect(store.rollups.some((r) => r.event_type === "PAID")).toBe(true);
  });
});
