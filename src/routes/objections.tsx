import { createFileRoute } from "@tanstack/react-router";
import { ObjectionsApp } from "@/components/objections/ObjectionsApp";

export const Route = createFileRoute("/objections")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as "log" | "trends" | "mapping" | undefined) ?? "log",
    lead_id: typeof search.lead_id === "string" ? search.lead_id : undefined,
    pathway: typeof search.pathway === "string" ? search.pathway : undefined,
  }),
  component: ObjectionsPage,
  head: () => ({
    meta: [
      { title: "Objection library · Workforce Europe" },
      {
        name: "description",
        content: "Counsellor one-tap logging, taxonomy mapping, and trends.",
      },
    ],
  }),
});

function ObjectionsPage() {
  const { tab, lead_id, pathway } = Route.useSearch();
  return (
    <ObjectionsApp initialTab={tab} leadId={lead_id} pathway={pathway} />
  );
}
