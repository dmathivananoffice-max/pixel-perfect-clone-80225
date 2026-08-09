import { createFileRoute } from "@tanstack/react-router";
import { DiagnosticApp } from "@/components/diagnostic/DiagnosticApp";

type DiagSearch = {
  b?: string;
};

export const Route = createFileRoute("/diagnostic")({
  validateSearch: (search: Record<string, unknown>): DiagSearch => ({
    b: typeof search.b === "string" ? search.b : undefined,
  }),
  component: DiagnosticPage,
  head: () => ({
    meta: [
      { title: "Pathway Diagnostic · Workforce Europe" },
      {
        name: "description",
        content:
          "Germany Career Assessment — find your honest pathway eligibility.",
      },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
});

function DiagnosticPage() {
  const { b } = Route.useSearch();
  return <DiagnosticApp initialBranch={b ?? null} />;
}
