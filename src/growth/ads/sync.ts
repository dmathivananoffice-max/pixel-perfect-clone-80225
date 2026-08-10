/** Hourly read sync orchestration (FR-AD-01 + FR-AD-04). */
import type { AdsReadAdapter } from "./adapter";
import type { MemoryAdsStore } from "./memoryStore";
import type { AdsReadConfig, AdsSyncResult, RemoteAdEntity } from "./types";
import { DEFAULT_ADS_READ_CONFIG } from "./types";
import { lintActiveAds } from "./utm";

export async function syncPlatformRead(opts: {
  adapter: AdsReadAdapter;
  store: MemoryAdsStore;
  accountExternalId: string;
  config?: AdsReadConfig;
}): Promise<AdsSyncResult> {
  const config = opts.config ?? DEFAULT_ADS_READ_CONFIG;
  const { adapter, store } = opts;

  if (!adapter.activated) {
    return {
      platform: adapter.platform,
      accounts: 0,
      entities: 0,
      metrics: 0,
      utm_alerts: 0,
      skipped_reason: adapter.inactiveReason ?? "adapter inactive",
    };
  }

  const snap = await adapter.fetchAccountSnapshot({
    accountExternalId: opts.accountExternalId,
    lookbackDays: config.sync_lookback_days,
  });

  const now = new Date().toISOString();
  const account = store.upsertAccount({
    platform: snap.platform,
    external_id: snap.account_external_id,
    name: snap.account_name,
    currency: snap.currency,
    daily_ceiling_eur: null,
    status: "active",
    synced_at: now,
  });

  // Insert parents before children
  const byExt = new Map<string, string>();
  const ordered = orderEntities(snap.entities);
  for (const e of ordered) {
    const parentId = e.parent_external_id
      ? (byExt.get(`${parentLevel(e.level)}:${e.parent_external_id}`) ??
        byExt.get(`campaign:${e.parent_external_id}`) ??
        byExt.get(`adset:${e.parent_external_id}`) ??
        byExt.get(`ad_group:${e.parent_external_id}`) ??
        null)
      : null;
    const row = store.upsertEntity({
      ad_account_id: account.id,
      level: e.level,
      external_id: e.external_id,
      name: e.name,
      parent_id: parentId,
      status: e.status,
      utm_template: e.utm_template,
      landing_url: e.landing_url,
      synced_at: now,
    });
    byExt.set(`${e.level}:${e.external_id}`, row.id);
  }

  let metricCount = 0;
  for (const m of snap.metrics) {
    const entityId = byExt.get(`${m.level}:${m.entity_external_id}`);
    if (!entityId) continue;
    store.upsertMetric({
      ad_entity_id: entityId,
      date: m.date,
      hour: m.hour ?? null,
      spend_eur: m.spend_eur,
      impressions: m.impressions,
      clicks: m.clicks,
      platform_conversions: m.platform_conversions,
      synced_at: now,
    });
    metricCount += 1;
  }

  const platformByAccount = new Map([[account.id, account.platform]]);
  const findings = lintActiveAds(
    store.entities.filter((e) => e.ad_account_id === account.id),
    platformByAccount,
    config,
  );
  store.replaceUtmAlerts(findings);

  return {
    platform: adapter.platform,
    accounts: 1,
    entities: ordered.length,
    metrics: metricCount,
    utm_alerts: findings.length,
  };
}

function parentLevel(level: RemoteAdEntity["level"]): string {
  if (level === "adset" || level === "ad_group") return "campaign";
  if (level === "ad") return "adset";
  if (level === "keyword") return "ad_group";
  return "campaign";
}

function orderEntities(entities: RemoteAdEntity[]): RemoteAdEntity[] {
  const rank: Record<string, number> = {
    campaign: 0,
    adset: 1,
    ad_group: 1,
    ad: 2,
    keyword: 2,
  };
  return [...entities].sort(
    (a, b) => (rank[a.level] ?? 9) - (rank[b.level] ?? 9),
  );
}
