import { createFileRoute } from "@tanstack/react-router";
import { ComplianceQueueApp } from "@/components/compliance/ComplianceQueueApp";

export const Route = createFileRoute("/compliance")({
  component: ComplianceQueueApp,
  head: () => ({
    meta: [
      { title: "Compliance queue · Workforce Europe" },
      {
        name: "description",
        content: "Review IN_REVIEW claim-bearing assets before send paths use them.",
      },
    ],
  }),
});
