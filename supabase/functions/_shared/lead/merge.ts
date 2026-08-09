import type { ClickIds, LeadRow, UtmObject } from "./types.ts";

/** Prefer existing non-blank; fill from incoming when existing is blank (FR-L-02). */
export function mergeScalar(
  existing: string | null | undefined,
  incoming: string | null | undefined,
): string | null {
  const e = existing?.trim() ? existing.trim() : null;
  const i = incoming?.trim() ? incoming.trim() : null;
  if (e) return e;
  return i;
}

/** Merge JSON maps: keep existing keys; add new; never replace with empty string. */
export function mergeJsonMap<T extends Record<string, string | undefined>>(
  existing: T | null | undefined,
  incoming: T | null | undefined,
): T {
  const out: Record<string, string | undefined> = { ...(existing ?? {}) };
  for (const [k, v] of Object.entries(incoming ?? {})) {
    if (v == null) continue;
    const s = String(v).trim();
    if (!s) continue;
    if (out[k] == null || String(out[k]).trim() === "") {
      out[k] = s;
    }
  }
  return out as T;
}

export type MergeLeadPatch = {
  name?: string;
  email?: string;
  city?: string;
  language?: string;
  utm?: UtmObject;
  click_ids?: ClickIds;
  diagnostic_session_id?: string;
  platform_candidate_id?: string;
};

/** Build updated lead fields without blanking existing data (FR-L-02). */
export function buildMergedLeadFields(
  existing: LeadRow,
  patch: MergeLeadPatch,
): Partial<LeadRow> {
  return {
    name: mergeScalar(existing.name, patch.name),
    email: mergeScalar(existing.email, patch.email),
    city: mergeScalar(existing.city, patch.city),
    language: mergeScalar(existing.language, patch.language) ?? existing.language,
    source_utm: mergeJsonMap(existing.source_utm, patch.utm),
    click_ids: mergeJsonMap(existing.click_ids, patch.click_ids),
    diagnostic_session_id:
      existing.diagnostic_session_id ||
      patch.diagnostic_session_id ||
      null,
    platform_candidate_id:
      existing.platform_candidate_id ||
      patch.platform_candidate_id ||
      null,
  };
}
