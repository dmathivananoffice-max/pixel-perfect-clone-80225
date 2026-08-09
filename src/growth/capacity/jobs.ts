/** pg-boss job names for M9 capacity governor. */

export const CAPACITY_JOBS = {
  HOURLY: "growth.capacity.governor.hourly",
} as const;

export type CapacityGovernorJobPayload = {
  trigger: "schedule" | "manual" | "intake_write";
  requested_at: string;
};
