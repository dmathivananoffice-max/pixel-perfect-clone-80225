/** Join campaign_metric ↔ funnel_event via UTM / click IDs (FR-AD-02). */
import type {
  AdAccount,
  AdEntity,
  AdsReadConfig,
  CampaignFunnelJoin,
  CampaignMetric,
  UtmLintFinding,
} from "./types";
import { DEFAULT_ADS_READ_CONFIG } from "./types";
import { lintUtmTemplate, parseUtmParams } from "./utm";

export type FunnelJoinEvent = {
  type: string;
  meta: Record<string, unknown>;
  at: string;
};

function ratio(spend: number, count: number): number | null {
  if (count <= 0) return null;
  return Math.round((spend / count) * 100) / 100;
}

function eventCampaignKey(meta: Record<string, unknown>): string | null {
  const utm =
    (meta.utm_campaign as string | undefined) ??
    (meta.campaign as string | undefined) ??
    ((meta.source_utm as Record<string, unknown> | undefined)?.utm_campaign as
      | string
      | undefined);
  if (utm) return String(utm);
  const clickIds = (meta.click_ids as Record<string, unknown> | undefined) ?? {};
  if (clickIds.fbclid) return `fbclid:${clickIds.fbclid}`;
  if (clickIds.gclid) return `gclid:${clickIds.gclid}`;
  return null;
}

function campaignKeys(entity: AdEntity): string[] {
  const keys = new Set<string>([entity.external_id, entity.name]);
  const params = parseUtmParams(entity.utm_template || entity.landing_url);
  if (params.utm_campaign) keys.add(params.utm_campaign);
  return [...keys];
}

export function joinCampaignsToFunnel(input: {
  accounts: AdAccount[];
  entities: AdEntity[];
  metrics: CampaignMetric[];
  events: FunnelJoinEvent[];
  lintFindings?: UtmLintFinding[];
  config?: AdsReadConfig;
}): CampaignFunnelJoin[] {
  const config = input.config ?? DEFAULT_ADS_READ_CONFIG;
  const accountById = new Map(input.accounts.map((a) => [a.id, a]));
  const campaigns = input.entities.filter((e) => e.level === "campaign");
  const ads = input.entities.filter((e) => e.level === "ad");

  const lintByEntity = new Map(
    (input.lintFindings ?? []).map((f) => [f.ad_entity_id, f]),
  );

  // Pre-index funnel counts by campaign key
  type FunnelCounts = {
    leads: number;
    mqls: number;
    sqls: number;
    attended: number;
    applications: number;
  };
  const counts = new Map<string, FunnelCounts>();
  const bump = (key: string, field: keyof FunnelCounts) => {
    const cur = counts.get(key) ?? {
      leads: 0,
      mqls: 0,
      sqls: 0,
      attended: 0,
      applications: 0,
    };
    cur[field] += 1;
    counts.set(key, cur);
  };

  for (const ev of input.events) {
    const key = eventCampaignKey(ev.meta);
    if (!key) continue;
    if (ev.type === "LEAD_CREATED" || ev.type === "LEAD_RETURNED") bump(key, "leads");
    if (ev.type === "BAND_ASSIGNED" || ev.type === "BAND_CHANGED") {
      const band = String(ev.meta.band ?? "").toUpperCase();
      if (band === "HOT" || band === "WARM") bump(key, "mqls");
      // SQL ≈ booked counselling interest — use BOOKING for SQL proxy in Phase 1
    }
    if (ev.type === "BOOKING_CREATED") bump(key, "sqls");
    if (ev.type === "COUNSELLING_ATTENDED") bump(key, "attended");
    if (ev.type === "APPLICATION_SUBMITTED") bump(key, "applications");
  }

  const metricByEntity = new Map<string, { spend: number; imps: number; clicks: number; conv: number }>();
  for (const m of input.metrics) {
    const cur = metricByEntity.get(m.ad_entity_id) ?? {
      spend: 0,
      imps: 0,
      clicks: 0,
      conv: 0,
    };
    cur.spend += m.spend_eur;
    cur.imps += m.impressions;
    cur.clicks += m.clicks;
    cur.conv += m.platform_conversions;
    metricByEntity.set(m.ad_entity_id, cur);
  }

  const rows: CampaignFunnelJoin[] = campaigns.map((c) => {
    const acct = accountById.get(c.ad_account_id);
    const platform = acct?.platform ?? "meta";
    const m = metricByEntity.get(c.id) ?? { spend: 0, imps: 0, clicks: 0, conv: 0 };
    let funnel = { leads: 0, mqls: 0, sqls: 0, attended: 0, applications: 0 };
    for (const k of campaignKeys(c)) {
      const part = counts.get(k);
      if (!part) continue;
      funnel = {
        leads: funnel.leads + part.leads,
        mqls: funnel.mqls + part.mqls,
        sqls: funnel.sqls + part.sqls,
        attended: funnel.attended + part.attended,
        applications: funnel.applications + part.applications,
      };
    }

    // Resolve parent chain: ad → adset → campaign via parent_id walk
    const byId = new Map(input.entities.map((e) => [e.id, e]));
    const adsUnder = ads.filter((a) => {
      let cur: AdEntity | undefined = a;
      for (let i = 0; i < 4 && cur; i++) {
        if (cur.id === c.id) return true;
        cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
      }
      return false;
    });

    let utm_lint =
      lintByEntity.get(c.id) ??
      adsUnder.map((a) => lintByEntity.get(a.id)).find(Boolean) ??
      null;
    if (!utm_lint) {
      for (const a of adsUnder) {
        const f = lintUtmTemplate(a, platform, config);
        if (f) {
          utm_lint = f;
          break;
        }
      }
    }

    return {
      campaign_id: c.id,
      campaign_external_id: c.external_id,
      campaign_name: c.name,
      platform,
      status: c.status,
      spend_eur: Math.round(m.spend * 100) / 100,
      impressions: m.imps,
      clicks: m.clicks,
      ctr: m.imps > 0 ? Math.round((m.clicks / m.imps) * 10000) / 100 : 0,
      cpc: m.clicks > 0 ? Math.round((m.spend / m.clicks) * 100) / 100 : 0,
      platform_conversions: m.conv,
      leads: funnel.leads,
      mqls: funnel.mqls,
      sqls: funnel.sqls,
      attended: funnel.attended,
      applications: funnel.applications,
      cost_per_lead: ratio(m.spend, funnel.leads),
      cost_per_mql: ratio(m.spend, funnel.mqls),
      cost_per_sql: ratio(m.spend, funnel.sqls),
      cost_per_attended: ratio(m.spend, funnel.attended),
      cost_per_application: ratio(m.spend, funnel.applications),
      no_qualified_leads_badge:
        m.spend >= config.no_mql_spend_threshold_eur && funnel.mqls === 0,
      utm_lint,
    };
  });

  return rows.sort((a, b) => {
    const aCpm = a.cost_per_mql ?? Number.POSITIVE_INFINITY;
    const bCpm = b.cost_per_mql ?? Number.POSITIVE_INFINITY;
    if (aCpm !== bCpm) return aCpm - bCpm;
    return b.spend_eur - a.spend_eur;
  });
}

export function totalSpendForDay(
  metrics: CampaignMetric[],
  entities: AdEntity[],
  day: string,
): number {
  const campaignIds = new Set(
    entities.filter((e) => e.level === "campaign").map((e) => e.id),
  );
  return metrics
    .filter((m) => m.date === day && campaignIds.has(m.ad_entity_id))
    .reduce((n, m) => n + m.spend_eur, 0);
}
