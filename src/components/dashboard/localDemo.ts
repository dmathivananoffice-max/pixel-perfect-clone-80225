import { AnalyticsService } from "@/growth/analytics/service";
import { createMemoryAnalyticsStore } from "@/growth/analytics/memoryStore";
import type { DashboardRole } from "@/growth/analytics/types";
import { AdsReadService } from "@/growth/ads/service";
import { createMemoryAdsStore } from "@/growth/ads/memoryStore";
import { createMetaReadAdapter } from "@/growth/ads/metaAdapter";
import { createGoogleReadAdapter } from "@/growth/ads/googleAdapter";

let store: ReturnType<typeof createMemoryAnalyticsStore> | null = null;
let svc: AnalyticsService | null = null;
let adsStore: ReturnType<typeof createMemoryAdsStore> | null = null;
let adsSvc: AdsReadService | null = null;
let seeded = false;
let adsSynced = false;

export function ensureDashboardDemo() {
  if (!store) {
    store = createMemoryAnalyticsStore();
    svc = new AnalyticsService(store);
  }
  if (!adsStore) {
    adsStore = createMemoryAdsStore();
    adsSvc = new AdsReadService(
      adsStore,
      [createMetaReadAdapter(), createGoogleReadAdapter()],
      { meta: "act_1001" },
    );
  }
  return { store, svc: svc!, adsStore, adsSvc: adsSvc! };
}

/**
 * Seed 10 Diagnostic journeys with mixed outcomes for funnel drop-off verify.
 * Funnel events carry utm_campaign so M13 join can attribute to Meta campaigns.
 */
export async function seedTenDiagnostics() {
  const { store, svc } = ensureDashboardDemo();
  if (seeded) {
    svc.runHourlyRollup();
    return svc;
  }
  seeded = true;
  const pathway = "nursing-professional";
  const source = "meta";
  const today = new Date().toISOString().slice(0, 10);
  const base = new Date(`${today}T12:00:00.000Z`).getTime();

  for (let i = 0; i < 10; i++) {
    const session = crypto.randomUUID();
    const lead = crypto.randomUUID();
    const at = (offsetSec: number) =>
      new Date(base + offsetSec * 1000).toISOString();
    const utm_campaign = "camp_nursing_in";
    const meta = {
      pathway,
      source,
      utm_campaign,
      utm_source: "meta",
      utm_medium: "paid_social",
      click_ids: { fbclid: `fb_${i}` },
    };

    await store.insertFunnelEvent({
      type: "DIAG_START",
      stage: "session",
      session_id: session,
      meta,
      at: at(i * 60),
    });

    const maxQ = i < 3 ? 5 : i < 6 ? 3 : i < 8 ? 1 : 0;
    for (let q = 0; q <= maxQ; q++) {
      await store.insertFunnelEvent({
        type: "DIAG_QUESTION_ANSWERED",
        stage: "diagnostic",
        session_id: session,
        meta: { ...meta, question_id: `q${q}`, question_index: q },
        at: at(i * 60 + 1 + q),
      });
    }

    if (maxQ >= 5) {
      await store.insertFunnelEvent({
        type: "DIAG_COMPLETE",
        stage: "diagnostic",
        session_id: session,
        lead_id: lead,
        meta,
        at: at(i * 60 + 20),
      });
      await store.insertFunnelEvent({
        type: "LEAD_CREATED",
        stage: "lead",
        session_id: session,
        lead_id: lead,
        meta,
        at: at(i * 60 + 21),
      });

      const band =
        i === 0 ? "HOT" : i === 1 ? "WARM" : i === 2 ? "DISQUALIFIED" : "NURTURE";
      const scoredAt = at(i * 60 + 22);
      store.scores.push({
        lead_id: lead,
        name: `Candidate ${i + 1}`,
        band,
        scored_at: scoredAt,
        dq_reason: band === "DISQUALIFIED" ? "language_too_low" : null,
        pathway,
      });
      await store.insertFunnelEvent({
        type: "BAND_ASSIGNED",
        stage: "score",
        lead_id: lead,
        meta: { ...meta, band },
        at: scoredAt,
      });

      if (band === "HOT" || band === "WARM") {
        await store.insertFunnelEvent({
          type: "BOOKING_CREATED",
          stage: "booking",
          lead_id: lead,
          meta,
          at: at(i * 60 + 23),
        });
      }
      if (i === 0) {
        await store.insertFunnelEvent({
          type: "COUNSELLING_ATTENDED",
          stage: "attended",
          lead_id: lead,
          meta: { ...meta, stub_manual: true, logged_by: "counsellor-demo" },
          at: at(i * 60 + 24),
        });
      }
    } else if (maxQ >= 1) {
      await store.insertFunnelEvent({
        type: "DIAG_ABANDONED",
        stage: "diagnostic",
        session_id: session,
        meta: { ...meta, question_index: maxQ },
        at: at(i * 60 + 10),
      });
    }
  }

  store.llm.push({
    day: today,
    module: "M4",
    tokens_in: 1200,
    tokens_out: 400,
    cost_eur: 0.42,
  });

  svc.runHourlyRollup();
  return svc;
}

export async function ensureAdsSynced() {
  const { adsSvc } = ensureDashboardDemo();
  if (!adsSynced) {
    await adsSvc.runHourlySync();
    adsSynced = true;
  }
  return adsSvc;
}

export async function demoHome(role: DashboardRole) {
  await seedTenDiagnostics();
  const ads = await ensureAdsSynced();
  const today = new Date().toISOString().slice(0, 10);
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  return ensureDashboardDemo().svc.home(
    role,
    { today: ads.spendForDay(today), yesterday: ads.spendForDay(y) },
    ads.utmAlerts(),
  );
}

export async function demoFunnel(pathway?: string, source?: string) {
  await seedTenDiagnostics();
  return ensureDashboardDemo().svc.funnel({ pathway, source });
}

export async function demoLeads() {
  await seedTenDiagnostics();
  return ensureDashboardDemo().svc.leads();
}

export async function demoCampaigns() {
  await seedTenDiagnostics();
  const { store, adsSvc } = ensureDashboardDemo();
  await ensureAdsSynced();
  return adsSvc.campaigns(store.events);
}

export function demoCoverage() {
  return ensureDashboardDemo().svc.coverage();
}
