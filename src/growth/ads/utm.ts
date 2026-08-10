/** UTM template generation + lint (FR-AD-04). */
import type {
  AdEntity,
  AdPlatform,
  AdsReadConfig,
  UtmLintFinding,
} from "./types";
import { DEFAULT_ADS_READ_CONFIG } from "./types";

export function generateUtmTemplate(
  platform: AdPlatform,
  campaignExternalId: string,
  adExternalId = "{{ad.id}}",
  config: AdsReadConfig = DEFAULT_ADS_READ_CONFIG,
): string {
  const base =
    platform === "meta" ? config.utm_template_meta : config.utm_template_google;
  return base
    .replaceAll("{{campaign.id}}", campaignExternalId)
    .replaceAll("{{ad.id}}", adExternalId);
}

export function parseUtmParams(
  template: string | null | undefined,
): Record<string, string> {
  if (!template?.trim()) return {};
  const query = template.includes("?")
    ? template.slice(template.indexOf("?") + 1)
    : template;
  const out: Record<string, string> = {};
  for (const part of query.split("&")) {
    const [k, ...rest] = part.split("=");
    if (!k) continue;
    out[decodeURIComponent(k)] = decodeURIComponent(rest.join("=") ?? "");
  }
  return out;
}

export function lintUtmTemplate(
  entity: Pick<AdEntity, "id" | "external_id" | "name" | "status" | "utm_template" | "landing_url">,
  platform: AdPlatform,
  config: AdsReadConfig = DEFAULT_ADS_READ_CONFIG,
): UtmLintFinding | null {
  const active = /^(ACTIVE|ENABLED|active)$/i.test(entity.status);
  if (!active) return null;

  const raw = entity.utm_template?.trim() || entity.landing_url?.trim() || "";
  if (!raw) {
    return {
      ad_entity_id: entity.id,
      external_id: entity.external_id,
      name: entity.name,
      platform,
      reason: "missing_template",
      missing_keys: [...config.utm_required_keys],
    };
  }

  const params = parseUtmParams(raw);
  const missing = config.utm_required_keys.filter(
    (k) => !params[k] || !String(params[k]).trim(),
  );
  if (missing.length === config.utm_required_keys.length) {
    // URL present but no UTM keys at all → treat as missing template
    return {
      ad_entity_id: entity.id,
      external_id: entity.external_id,
      name: entity.name,
      platform,
      reason: "missing_template",
      missing_keys: missing,
    };
  }
  if (missing.length) {
    return {
      ad_entity_id: entity.id,
      external_id: entity.external_id,
      name: entity.name,
      platform,
      reason: "missing_keys",
      missing_keys: missing,
    };
  }
  return null;
}

export function lintActiveAds(
  entities: AdEntity[],
  platformByAccount: Map<string, AdPlatform>,
  config: AdsReadConfig = DEFAULT_ADS_READ_CONFIG,
): UtmLintFinding[] {
  const findings: UtmLintFinding[] = [];
  for (const e of entities) {
    if (e.level !== "ad" && e.level !== "campaign") continue;
    const platform = platformByAccount.get(e.ad_account_id);
    if (!platform) continue;
    // Prefer linting ads; also lint campaigns with landing URLs
    if (e.level === "campaign" && !e.landing_url && e.utm_template) continue;
    if (e.level === "campaign" && e.utm_template) {
      // campaigns with complete templates are ok — skip unless broken
      const f = lintUtmTemplate(e, platform, config);
      if (f) findings.push(f);
      continue;
    }
    if (e.level === "ad") {
      const f = lintUtmTemplate(e, platform, config);
      if (f) findings.push(f);
    }
  }
  return findings;
}
