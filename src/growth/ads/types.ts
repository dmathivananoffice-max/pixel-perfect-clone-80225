/** M13 Ad Platform Control — READ side (FR-AD-01/02/04). */

export type AdPlatform = "meta" | "google";

export type AdEntityLevel =
  | "campaign"
  | "adset"
  | "ad"
  | "ad_group"
  | "keyword";

export type AdAccount = {
  id: string;
  platform: AdPlatform;
  external_id: string;
  name: string;
  currency: string;
  daily_ceiling_eur: number | null;
  status: "active" | "paused" | "disabled";
  synced_at: string | null;
};

export type AdEntity = {
  id: string;
  ad_account_id: string;
  level: AdEntityLevel;
  external_id: string;
  name: string;
  parent_id: string | null;
  status: string;
  utm_template: string | null;
  landing_url: string | null;
  synced_at: string;
};

export type CampaignMetric = {
  id: string;
  ad_entity_id: string;
  date: string;
  hour: number | null;
  spend_eur: number;
  impressions: number;
  clicks: number;
  platform_conversions: number;
  synced_at: string;
};

/** Platform-fetched snapshot before persistence (read adapters only). */
export type RemoteAdEntity = {
  level: AdEntityLevel;
  external_id: string;
  name: string;
  parent_external_id: string | null;
  status: string;
  utm_template: string | null;
  landing_url: string | null;
};

export type RemoteMetric = {
  entity_external_id: string;
  level: AdEntityLevel;
  date: string;
  hour?: number | null;
  spend_eur: number;
  impressions: number;
  clicks: number;
  platform_conversions: number;
};

export type RemoteAccountSnapshot = {
  platform: AdPlatform;
  account_external_id: string;
  account_name: string;
  currency: string;
  entities: RemoteAdEntity[];
  metrics: RemoteMetric[];
};

export type UtmLintFinding = {
  ad_entity_id: string;
  external_id: string;
  name: string;
  platform: AdPlatform;
  reason: "missing_template" | "missing_keys" | "malformed";
  missing_keys: string[];
};

export type CampaignFunnelJoin = {
  campaign_id: string;
  campaign_external_id: string;
  campaign_name: string;
  platform: AdPlatform;
  status: string;
  spend_eur: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  platform_conversions: number;
  leads: number;
  mqls: number;
  sqls: number;
  attended: number;
  applications: number;
  cost_per_lead: number | null;
  cost_per_mql: number | null;
  cost_per_sql: number | null;
  cost_per_attended: number | null;
  cost_per_application: number | null;
  no_qualified_leads_badge: boolean;
  utm_lint: UtmLintFinding | null;
};

export type AdsSyncResult = {
  platform: AdPlatform;
  accounts: number;
  entities: number;
  metrics: number;
  utm_alerts: number;
  skipped_reason?: string;
};

export type AdsReadConfig = {
  utm_required_keys: string[];
  utm_template_meta: string;
  utm_template_google: string;
  no_mql_spend_threshold_eur: number;
  sync_lookback_days: number;
};

export const DEFAULT_ADS_READ_CONFIG: AdsReadConfig = {
  utm_required_keys: ["utm_source", "utm_medium", "utm_campaign"],
  utm_template_meta:
    "utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_content={{ad.id}}",
  utm_template_google:
    "utm_source=google&utm_medium=cpc&utm_campaign={{campaign.id}}&utm_content={{ad.id}}",
  no_mql_spend_threshold_eur: 50,
  sync_lookback_days: 7,
};
