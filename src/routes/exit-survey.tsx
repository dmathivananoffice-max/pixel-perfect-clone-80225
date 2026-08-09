import { createFileRoute } from "@tanstack/react-router";
import { ExitSurveyApp } from "@/components/objections/ExitSurveyApp";

export const Route = createFileRoute("/exit-survey")({
  validateSearch: (search: Record<string, unknown>) => ({
    lead_id: typeof search.lead_id === "string" ? search.lead_id : undefined,
    session_id:
      typeof search.session_id === "string" ? search.session_id : undefined,
    pathway: typeof search.pathway === "string" ? search.pathway : undefined,
  }),
  component: ExitSurveyPage,
  head: () => ({
    meta: [
      { title: "Diagnostic exit survey · Workforce Europe" },
      {
        name: "description",
        content: "Tell us why you paused the Pathway Diagnostic.",
      },
    ],
  }),
});

function ExitSurveyPage() {
  const { lead_id, session_id, pathway } = Route.useSearch();
  return (
    <ExitSurveyApp
      leadId={lead_id}
      sessionId={session_id}
      pathway={pathway}
    />
  );
}
