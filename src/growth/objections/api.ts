import type { LogObjectionInput, ObjectionRecord, TaxonomyMapping, TrendRow } from "./types";

function base(): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  return url ? `${url.replace(/\/$/, "")}/functions/v1/objection-library` : "";
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

export function logObjection(input: LogObjectionInput) {
  return call<{ objection: ObjectionRecord }>({ action: "log", ...input });
}

export function listMappings() {
  return call<{ mappings: TaxonomyMapping[] }>({ action: "list_mappings" });
}

export function upsertMapping(
  mapping: Partial<TaxonomyMapping> & { code: string; updated_by: string },
) {
  return call<{ mapping: TaxonomyMapping }>({ action: "upsert_mapping", ...mapping });
}

export function fetchTrends(weeks = 8, pathway?: string) {
  return call<{ trends: TrendRow[] }>({
    action: "trends",
    weeks,
    pathway: pathway || null,
  });
}

export function listRecent(limit = 20) {
  return call<{ objections: ObjectionRecord[] }>({ action: "list_recent", limit });
}
