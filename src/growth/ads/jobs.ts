/** pg-boss job names for M13 read-only ads sync. */

export const ADS_JOBS = {
  HOURLY_SYNC: "growth.ads.read_sync.hourly",
} as const;

export type AdsReadSyncJobPayload = {
  trigger: "schedule" | "manual";
  requested_at: string;
};
