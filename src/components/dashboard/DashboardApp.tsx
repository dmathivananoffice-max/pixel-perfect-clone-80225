import { useEffect, useState } from "react";
import { areasForRole, canView } from "@/growth/analytics/roles";
import type { DashboardRole, HomeMetrics } from "@/growth/analytics/types";
import { DefinitionTip } from "./DefinitionTip";
import { FunnelPanel } from "./FunnelPanel";
import { HomePanel } from "./HomePanel";
import { LeadsPanel } from "./LeadsPanel";
import {
  demoCoverage,
  demoFunnel,
  demoHome,
  demoLeads,
} from "./localDemo";
import "./dashboard.css";

type Tab = "home" | "funnel" | "leads";

export function DashboardApp({ initialTab = "home" }: { initialTab?: Tab }) {
  const [role, setRole] = useState<DashboardRole>("marketing_operator");
  const [tab, setTab] = useState<Tab>(initialTab);
  const [tip, setTip] = useState<string | null>(null);
  const [home, setHome] = useState<HomeMetrics | null>(null);
  const [funnel, setFunnel] = useState<Awaited<ReturnType<typeof demoFunnel>> | null>(null);
  const [leads, setLeads] = useState<Awaited<ReturnType<typeof demoLeads>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const coverage = demoCoverage();

  useEffect(() => {
    const allowed = areasForRole(role);
    if (tab === "home" && !allowed.includes("home")) setTab("leads");
    if (tab === "funnel" && !allowed.includes("funnel")) setTab("leads");
  }, [role, tab]);

  useEffect(() => {
    void (async () => {
      setErr(null);
      try {
        if (tab === "home" && canView(role, "home")) {
          const h = await demoHome(role);
          if ("error" in h) setErr(h.error);
          else setHome(h);
        } else if (tab === "funnel" && canView(role, "funnel")) {
          setFunnel(await demoFunnel());
        } else if (tab === "leads") {
          setLeads(await demoLeads());
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "load failed");
      }
    })();
  }, [tab, role]);

  return (
    <div className="dash">
      <div className="dash__shell">
        <p className="dash__brand">Workforce Europe · Operator dashboard</p>
        <h1 className="dash__title">Growth overview</h1>
        <p className="dash__sub">
          Plain-language numbers from your owned funnel. Tap any metric for a
          definition. Event coverage: {coverage.live.length} live writers,{" "}
          {coverage.stubs.length} counsellor stubs.
        </p>

        <nav className="dash__nav">
          {(
            [
              ["home", "Home"],
              ["funnel", "Funnel"],
              ["leads", "Leads"],
            ] as const
          ).map(([id, label]) => {
            const allowed =
              id === "leads" ||
              canView(role, id === "home" ? "home" : "funnel");
            if (!allowed) return null;
            return (
              <button
                key={id}
                type="button"
                data-active={tab === id}
                data-testid={`tab-${id}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            );
          })}
          <label className="dash__role">
            View as
            <select
              value={role}
              data-testid="role-select"
              onChange={(e) => setRole(e.target.value as DashboardRole)}
            >
              <option value="marketing_operator">Operator</option>
              <option value="counsellor">Counsellor</option>
              <option value="compliance_reviewer">Compliance</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </nav>

        {err ? <p className="dash__breached">{err}</p> : null}
        {tab === "home" && home ? (
          <HomePanel data={home} onDefine={setTip} />
        ) : null}
        {tab === "funnel" && funnel ? (
          <FunnelPanel data={funnel} onDefine={setTip} />
        ) : null}
        {tab === "leads" && leads ? (
          <LeadsPanel data={leads} onDefine={setTip} />
        ) : null}
      </div>
      {tip ? <DefinitionTip glossaryKey={tip} onClose={() => setTip(null)} /> : null}
    </div>
  );
}
