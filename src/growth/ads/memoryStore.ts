import type {
  AdAccount,
  AdEntity,
  CampaignMetric,
  UtmLintFinding,
} from "./types";

export type AdsAlert = {
  severity: string;
  code: string;
  title: string;
  body: string;
  href?: string;
  active: boolean;
};

export function createMemoryAdsStore() {
  const accounts: AdAccount[] = [];
  const entities: AdEntity[] = [];
  const metrics: CampaignMetric[] = [];
  const alerts: AdsAlert[] = [];

  return {
    accounts,
    entities,
    metrics,
    alerts,
    upsertAccount(input: Omit<AdAccount, "id"> & { id?: string }): AdAccount {
      const existing = accounts.find(
        (a) =>
          a.platform === input.platform && a.external_id === input.external_id,
      );
      if (existing) {
        Object.assign(existing, input, { id: existing.id });
        return existing;
      }
      const row: AdAccount = {
        id: input.id ?? crypto.randomUUID(),
        platform: input.platform,
        external_id: input.external_id,
        name: input.name,
        currency: input.currency,
        daily_ceiling_eur: input.daily_ceiling_eur,
        status: input.status,
        synced_at: input.synced_at,
      };
      accounts.push(row);
      return row;
    },
    upsertEntity(
      input: Omit<AdEntity, "id" | "synced_at"> & {
        id?: string;
        synced_at?: string;
      },
    ): AdEntity {
      const existing = entities.find(
        (e) =>
          e.ad_account_id === input.ad_account_id &&
          e.level === input.level &&
          e.external_id === input.external_id,
      );
      if (existing) {
        Object.assign(existing, input, {
          id: existing.id,
          synced_at: input.synced_at ?? new Date().toISOString(),
        });
        return existing;
      }
      const row: AdEntity = {
        id: input.id ?? crypto.randomUUID(),
        ad_account_id: input.ad_account_id,
        level: input.level,
        external_id: input.external_id,
        name: input.name,
        parent_id: input.parent_id,
        status: input.status,
        utm_template: input.utm_template,
        landing_url: input.landing_url,
        synced_at: input.synced_at ?? new Date().toISOString(),
      };
      entities.push(row);
      return row;
    },
    upsertMetric(
      input: Omit<CampaignMetric, "id" | "synced_at"> & {
        id?: string;
        synced_at?: string;
      },
    ): CampaignMetric {
      const existing = metrics.find(
        (m) =>
          m.ad_entity_id === input.ad_entity_id &&
          m.date === input.date &&
          m.hour === input.hour,
      );
      if (existing) {
        Object.assign(existing, input, {
          id: existing.id,
          synced_at: input.synced_at ?? new Date().toISOString(),
        });
        return existing;
      }
      const row: CampaignMetric = {
        id: input.id ?? crypto.randomUUID(),
        ad_entity_id: input.ad_entity_id,
        date: input.date,
        hour: input.hour,
        spend_eur: input.spend_eur,
        impressions: input.impressions,
        clicks: input.clicks,
        platform_conversions: input.platform_conversions,
        synced_at: input.synced_at ?? new Date().toISOString(),
      };
      metrics.push(row);
      return row;
    },
    replaceUtmAlerts(findings: UtmLintFinding[]) {
      // deactivate previous UTM alerts
      for (const a of alerts) {
        if (a.code === "UTM_MISSING" || a.code === "UTM_MALFORMED") a.active = false;
      }
      for (const f of findings) {
        alerts.push({
          severity: "warn",
          code: f.reason === "missing_template" ? "UTM_MISSING" : "UTM_MALFORMED",
          title: "Ad missing tracking tags",
          body: `"${f.name}" is live but its link is missing ${f.missing_keys.join(", ") || "UTM tags"}. Fix the URL template so we can join ad spend to leads.`,
          href: "/dashboard?tab=campaigns",
          active: true,
        });
      }
    },
    activeAlerts() {
      return alerts.filter((a) => a.active);
    },
  };
}

export type MemoryAdsStore = ReturnType<typeof createMemoryAdsStore>;
