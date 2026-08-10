function base(): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  return url ? `${url.replace(/\/$/, "")}/functions/v1/analytics-dashboard` : "";
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

export function fetchHome(role: string) {
  return call<{ home: unknown }>({ action: "home", role });
}

export function fetchFunnel(role: string, pathway?: string, source?: string) {
  return call<{ funnel: unknown }>({ action: "funnel", role, pathway, source });
}

export function fetchLeads(role: string) {
  return call<{ leads: unknown }>({ action: "leads", role });
}

export function runRollup() {
  return call<{ ok: boolean }>({ action: "run_rollup" });
}

export function logCounsellorOutcome(input: Record<string, unknown>) {
  return call<{ event: unknown }>({ action: "counsellor_outcome", ...input });
}
