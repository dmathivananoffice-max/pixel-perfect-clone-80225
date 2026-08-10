export const ANALYTICS_JOBS = {
  HOURLY_ROLLUP: "growth.analytics.rollup.hourly",
} as const;

export type AnalyticsRollupJobPayload = {
  trigger: "schedule" | "manual" | "seed";
  days?: number;
  requested_at: string;
};
