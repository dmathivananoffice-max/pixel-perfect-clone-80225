import { createFileRoute } from "@tanstack/react-router";
import { DashboardApp } from "@/components/dashboard/DashboardApp";

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as "home" | "funnel" | "leads" | undefined) ?? "home",
  }),
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard · Workforce Europe" },
      {
        name: "description",
        content: "Home, funnel, and leads — plain-language growth metrics.",
      },
    ],
  }),
});

function DashboardPage() {
  const { tab } = Route.useSearch();
  return <DashboardApp initialTab={tab} />;
}
