/** Thin HTTP helpers for ads-read edge function. */
import type { AdsSyncResult, CampaignFunnelJoin } from "./types";

export type AdsDashboardPayload = {
  spend_today_eur: number;
  spend_yesterday_eur: number;
  campaigns: CampaignFunnelJoin[];
  utm_alerts: {
    severity: string;
    code: string;
    title: string;
    body: string;
    href?: string;
  }[];
  sync?: AdsSyncResult[];
  /** Explicit confirmation for operators / audits. */
  write_scopes: "none";
};
