/**
 * Google Ads read adapter — same AdsReadAdapter interface as Meta.
 *
 * TODO-GOOGLE-TOKEN: Developer token approval (R-01) can take 2–6 weeks.
 * Until GOOGLE_ADS_DEVELOPER_TOKEN is present, this adapter stays inactive
 * and sync skips Google with a clear reason. Tests mock activation.
 *
 * READ ONLY — no mutate / mutateCampaign / BudgetService calls.
 */
import type { AdsReadAdapter } from "./adapter";
import type { RemoteAccountSnapshot, RemoteAdEntity, RemoteMetric } from "./types";

export type GoogleAdapterOptions = {
  /** TODO-GOOGLE-TOKEN — required for live activation. */
  developerToken?: string | null;
  customerId?: string;
  /** Test-only mock snapshot when token is present (or forced). */
  mockSnapshot?: RemoteAccountSnapshot;
  /** Force activated=true in unit tests without a real token. */
  forceActivateForTest?: boolean;
};

export function createGoogleReadAdapter(
  opts: GoogleAdapterOptions = {},
): AdsReadAdapter {
  const token =
    opts.developerToken ?? process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? null;
  const activated = Boolean(opts.forceActivateForTest || token);

  return {
    platform: "google",
    activated,
    inactiveReason: activated
      ? undefined
      : "TODO-GOOGLE-TOKEN: waiting for Google Ads developer token (R-01)",
    async fetchAccountSnapshot({ accountExternalId, lookbackDays }) {
      if (!activated) {
        throw new Error(
          "TODO-GOOGLE-TOKEN: Google Ads read adapter is not activated",
        );
      }
      if (opts.mockSnapshot) return opts.mockSnapshot;

      // Live path reserved for when the token arrives — still GET/searchStream only.
      // No mutate services are imported or called here.
      void lookbackDays;
      return {
        platform: "google",
        account_external_id: accountExternalId,
        account_name: `Google customer ${accountExternalId}`,
        currency: "EUR",
        entities: [] as RemoteAdEntity[],
        metrics: [] as RemoteMetric[],
      };
    },
  };
}

/** Test helper: mock Google snapshot shaped like Meta fixture output. */
export function mockGoogleSnapshot(
  overrides: Partial<RemoteAccountSnapshot> = {},
): RemoteAccountSnapshot {
  const today = new Date().toISOString().slice(0, 10);
  return {
    platform: "google",
    account_external_id: "cust_9001",
    account_name: "WFE Google — mock",
    currency: "EUR",
    entities: [
      {
        level: "campaign",
        external_id: "gcamp_1",
        name: "Search — Nursing",
        parent_external_id: null,
        status: "ENABLED",
        utm_template:
          "utm_source=google&utm_medium=cpc&utm_campaign=gcamp_1&utm_content={{ad.id}}",
        landing_url:
          "https://workforce.europe/diag?utm_source=google&utm_medium=cpc&utm_campaign=gcamp_1",
      },
    ],
    metrics: [
      {
        entity_external_id: "gcamp_1",
        level: "campaign",
        date: today,
        hour: null,
        spend_eur: 40,
        impressions: 5000,
        clicks: 90,
        platform_conversions: 3,
      },
    ],
    ...overrides,
  };
}
