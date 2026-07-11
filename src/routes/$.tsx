import { createFileRoute } from "@tanstack/react-router";
import { LegacyAppMount } from "../legacy-mount";

export const Route = createFileRoute("/$")({
  component: LegacyAppMount,
});
