import type { AssetRecord, ClaimChecklist } from "./types";

function base(): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  return url ? `${url.replace(/\/$/, "")}/functions/v1/asset-compliance` : "";
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

export function listInReview() {
  return call<{ assets: AssetRecord[] }>({ action: "list_in_review" });
}

export function getAsset(asset_id: string) {
  return call<{ asset: AssetRecord; prior: AssetRecord | null }>({
    action: "get",
    asset_id,
  });
}

export function reviewAsset(input: {
  asset_id: string;
  actor_id: string;
  decision: "approve" | "reject";
  comment?: string;
  claim_checklist?: ClaimChecklist;
}) {
  return call<{ asset: AssetRecord }>({ action: "review", ...input });
}
