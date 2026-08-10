import type { DashboardRole } from "./types";

/** FR-DB-06 role-scoped dashboard areas. */
export type DashboardArea =
  | "home"
  | "funnel"
  | "leads"
  | "campaigns"
  | "system_costs"
  | "alerts";

const SCOPE: Record<DashboardRole, DashboardArea[]> = {
  counsellor: ["leads"],
  compliance_reviewer: ["alerts"],
  marketing_operator: [
    "home",
    "funnel",
    "leads",
    "campaigns",
    "system_costs",
    "alerts",
  ],
  admin: ["home", "funnel", "leads", "campaigns", "system_costs", "alerts"],
};

export function areasForRole(role: DashboardRole): DashboardArea[] {
  return SCOPE[role] ?? ["leads"];
}

export function canView(role: DashboardRole, area: DashboardArea): boolean {
  return areasForRole(role).includes(area);
}
