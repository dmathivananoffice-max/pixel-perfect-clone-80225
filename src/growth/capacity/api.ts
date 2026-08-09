import type {
  IntakeRecord,
  PathwayCapacityState,
  WaitlistCta,
} from "./types";

function base(): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  return url ? `${url.replace(/\/$/, "")}/functions/v1/capacity-governor` : "";
}

async function call<T>(payload: Record<string, unknown>): Promise<T> {
  const endpoint = base();
  if (!endpoint) throw new Error("Supabase URL not configured");
  const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(anon ? { apikey: anon, Authorization: `Bearer ${anon}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data as T;
}

export function listIntakes() {
  return call<{ intakes: IntakeRecord[] }>({ action: "list_intakes" });
}

export function upsertIntake(input: Record<string, unknown>) {
  return call<{ intake: IntakeRecord }>({ action: "upsert_intake", ...input });
}

export function runGovernor() {
  return call<{ states: PathwayCapacityState[] }>({ action: "run_governor" });
}

export function listPathwayStates() {
  return call<{ states: PathwayCapacityState[] }>({ action: "list_states" });
}

export function getPathwayCta(pathway: string) {
  return call<{ cta: WaitlistCta }>({ action: "resolve_cta", pathway });
}
