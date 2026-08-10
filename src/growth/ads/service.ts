import type { AdsReadAdapter } from "./adapter";
import { joinCampaignsToFunnel, totalSpendForDay } from "./join";
import type { MemoryAdsStore } from "./memoryStore";
import { syncPlatformRead } from "./sync";
import type {
  AdsReadConfig,
  AdsSyncResult,
  CampaignFunnelJoin,
} from "./types";
import { DEFAULT_ADS_READ_CONFIG } from "./types";
import { generateUtmTemplate, lintActiveAds } from "./utm";

export type FunnelEventSource = {
  type: string;
  meta: Record<string, unknown>;
  at: string;
};

export class AdsReadService {
  constructor(
    private store: MemoryAdsStore,
    private adapters: AdsReadAdapter[],
    private accountIds: Partial<Record<"meta" | "google", string>> = {
      meta: "act_1001",
    },
    private config: AdsReadConfig = DEFAULT_ADS_READ_CONFIG,
  ) {}

  /** Hourly job entry — Meta always; Google only when activated. */
  async runHourlySync(): Promise<AdsSyncResult[]> {
    const results: AdsSyncResult[] = [];
    for (const adapter of this.adapters) {
      const accountExternalId =
        this.accountIds[adapter.platform] ?? `unknown_${adapter.platform}`;
      results.push(
        await syncPlatformRead({
          adapter,
          store: this.store,
          accountExternalId,
          config: this.config,
        }),
      );
    }
    return results;
  }

  campaigns(events: FunnelEventSource[]): CampaignFunnelJoin[] {
    const platformByAccount = new Map(
      this.store.accounts.map((a) => [a.id, a.platform] as const),
    );
    const findings = lintActiveAds(
      this.store.entities,
      platformByAccount,
      this.config,
    );
    return joinCampaignsToFunnel({
      accounts: this.store.accounts,
      entities: this.store.entities,
      metrics: this.store.metrics,
      events,
      lintFindings: findings,
      config: this.config,
    });
  }

  spendForDay(day: string): number {
    return (
      Math.round(
        totalSpendForDay(this.store.metrics, this.store.entities, day) * 100,
      ) / 100
    );
  }

  utmAlerts() {
    return this.store.activeAlerts().filter(
      (a) => a.code === "UTM_MISSING" || a.code === "UTM_MALFORMED",
    );
  }

  suggestedTemplate(platform: "meta" | "google", campaignId: string) {
    return generateUtmTemplate(platform, campaignId, "{{ad.id}}", this.config);
  }
}
