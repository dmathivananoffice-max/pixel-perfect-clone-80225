export { FORBIDDEN_ADAPTER_METHODS, type AdsReadAdapter } from "./adapter";
export { createMetaReadAdapter } from "./metaAdapter";
export {
  createGoogleReadAdapter,
  mockGoogleSnapshot,
} from "./googleAdapter";
export { createMetaReadClient } from "./metaReadClient";
export { AdsReadService } from "./service";
export { createMemoryAdsStore } from "./memoryStore";
export { syncPlatformRead } from "./sync";
export { joinCampaignsToFunnel, totalSpendForDay } from "./join";
export {
  generateUtmTemplate,
  lintUtmTemplate,
  lintActiveAds,
  parseUtmParams,
} from "./utm";
export { ADS_JOBS } from "./jobs";
export type {
  AdsSyncResult,
  CampaignFunnelJoin,
  UtmLintFinding,
} from "./types";
