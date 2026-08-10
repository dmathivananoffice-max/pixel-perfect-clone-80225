import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { CounsellorLog } from "./CounsellorLog";
import { MappingAdmin } from "./MappingAdmin";
import { TrendsView } from "./TrendsView";
import "./objections.css";

type Tab = "log" | "trends" | "mapping";

export function ObjectionsApp({
  initialTab = "log",
  leadId,
  pathway,
}: {
  initialTab?: Tab;
  leadId?: string;
  pathway?: string;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="obj">
      <div className="obj__shell">
        <p className="obj__brand">Workforce Europe · Objections</p>
        <h1 className="obj__title">Objection library</h1>
        <p className="obj__sub">
          One-tap counsellor logging, taxonomy mapping, and weekly trends
          (FR-O-01…03).
        </p>
        <nav className="obj__nav">
          {(
            [
              ["log", "Log"],
              ["trends", "Trends"],
              ["mapping", "Mapping"],
            ] as const
          ).map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              data-active={tab === id}
              onClick={(e) => {
                e.preventDefault();
                setTab(id);
              }}
            >
              {label}
            </a>
          ))}
          <Link to="/exit-survey">Exit survey</Link>
        </nav>
        {tab === "log" ? (
          <CounsellorLog
            defaultLeadId={leadId}
            defaultPathway={pathway}
            onLogged={() => {
              setRefreshKey((n) => n + 1);
              setTab("trends");
            }}
          />
        ) : null}
        {tab === "trends" ? <TrendsView refreshKey={refreshKey} /> : null}
        {tab === "mapping" ? <MappingAdmin /> : null}
      </div>
    </div>
  );
}
