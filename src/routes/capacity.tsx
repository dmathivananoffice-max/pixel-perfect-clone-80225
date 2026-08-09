import { createFileRoute } from "@tanstack/react-router";
import { CapacityApp } from "@/components/capacity/CapacityApp";

export const Route = createFileRoute("/capacity")({
  component: CapacityApp,
  head: () => ({
    meta: [
      { title: "Capacity governor · Workforce Europe" },
      {
        name: "description",
        content: "Manage intake capacity and pathway waitlist throttle flags.",
      },
    ],
  }),
});
