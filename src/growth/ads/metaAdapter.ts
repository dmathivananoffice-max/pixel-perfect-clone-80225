/**
 * Meta Marketing API read adapter (FR-AD-01).
 * Uses ads_read-equivalent fields only. No ads_management / mutation paths.
 */
import type { AdsReadAdapter } from "./adapter";
import type { MetaGetJson } from "./metaReadClient";
import type { RemoteAccountSnapshot, RemoteAdEntity, RemoteMetric } from "./types";
import sample from "./fixtures/meta-sample.json";

export type MetaAdapterOptions = {
  /** Live Graph GET client — omit to use the built-in fixture snapshot. */
  getJson?: MetaGetJson;
  accountExternalId?: string;
  /** Override fixture for tests (e.g. deliberately break a UTM). */
  fixture?: typeof sample;
};

export function createMetaReadAdapter(opts: MetaAdapterOptions = {}): AdsReadAdapter {
  const fixture = opts.fixture ?? sample;
  const accountId = opts.accountExternalId ?? fixture.account_external_id;

  return {
    platform: "meta",
    activated: true,
    async fetchAccountSnapshot({ accountExternalId, lookbackDays }) {
      if (opts.getJson) {
        return fetchLiveMeta(opts.getJson, accountExternalId, lookbackDays);
      }
      const today = new Date().toISOString().slice(0, 10);
      return {
        platform: "meta",
        account_external_id: accountExternalId || accountId,
        account_name: fixture.account_name,
        currency: fixture.currency,
        entities: fixture.entities as RemoteAdEntity[],
        metrics: (fixture.metrics as Omit<RemoteMetric, "date">[]).map((m) => ({
          ...m,
          date: today,
          hour: null,
        })),
      };
    },
  };
}

async function fetchLiveMeta(
  getJson: MetaGetJson,
  accountExternalId: string,
  lookbackDays: number,
): Promise<RemoteAccountSnapshot> {
  const act = accountExternalId.startsWith("act_")
    ? accountExternalId
    : `act_${accountExternalId}`;
  const since = new Date(Date.now() - lookbackDays * 86400000)
    .toISOString()
    .slice(0, 10);
  const until = new Date().toISOString().slice(0, 10);

  const campaigns = (await getJson(`/${act}/campaigns`, {
    fields: "id,name,status,effective_status",
    limit: "200",
  })) as { data?: { id: string; name: string; status: string; effective_status?: string }[] };

  const adsets = (await getJson(`/${act}/adsets`, {
    fields: "id,name,status,campaign_id",
    limit: "500",
  })) as {
    data?: { id: string; name: string; status: string; campaign_id: string }[];
  };

  const ads = (await getJson(`/${act}/ads`, {
    fields: "id,name,status,adset_id,creative{url_tags,object_story_spec}",
    limit: "500",
  })) as {
    data?: {
      id: string;
      name: string;
      status: string;
      adset_id: string;
      creative?: { url_tags?: string };
    }[];
  };

  const insights = (await getJson(`/${act}/insights`, {
    level: "campaign",
    fields: "campaign_id,spend,impressions,clicks,actions",
    time_increment: "1",
    time_range: JSON.stringify({ since, until }),
    limit: "500",
  })) as {
    data?: {
      campaign_id: string;
      date_start: string;
      spend: string;
      impressions: string;
      clicks: string;
      actions?: { action_type: string; value: string }[];
    }[];
  };

  const entities: RemoteAdEntity[] = [
    ...(campaigns.data ?? []).map((c) => ({
      level: "campaign" as const,
      external_id: c.id,
      name: c.name,
      parent_external_id: null,
      status: c.effective_status ?? c.status,
      utm_template: null,
      landing_url: null,
    })),
    ...(adsets.data ?? []).map((a) => ({
      level: "adset" as const,
      external_id: a.id,
      name: a.name,
      parent_external_id: a.campaign_id,
      status: a.status,
      utm_template: null,
      landing_url: null,
    })),
    ...(ads.data ?? []).map((a) => ({
      level: "ad" as const,
      external_id: a.id,
      name: a.name,
      parent_external_id: a.adset_id,
      status: a.status,
      utm_template: a.creative?.url_tags ?? null,
      landing_url: null,
    })),
  ];

  const metrics: RemoteMetric[] = (insights.data ?? []).map((row) => {
    const conv =
      row.actions?.find((x) => x.action_type === "offsite_conversion")?.value ??
      row.actions?.find((x) => x.action_type === "lead")?.value ??
      "0";
    return {
      entity_external_id: row.campaign_id,
      level: "campaign",
      date: row.date_start,
      hour: null,
      spend_eur: Number(row.spend) || 0,
      impressions: Number(row.impressions) || 0,
      clicks: Number(row.clicks) || 0,
      platform_conversions: Number(conv) || 0,
    };
  });

  const acct = (await getJson(`/${act}`, {
    fields: "id,name,currency",
  })) as { id: string; name: string; currency: string };

  return {
    platform: "meta",
    account_external_id: act,
    account_name: acct.name,
    currency: acct.currency ?? "EUR",
    entities,
    metrics,
  };
}
