import { supabase } from "@/integrations/supabase/client";

/** Days a binned candidate is kept before the nightly job purges it. */
export const BIN_RETENTION_DAYS = 30;

/** Soft-delete: move candidates into the 30-day bin. */
export async function moveCandidatesToBin(ids: string[], actorName?: string) {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("candidates")
    .update({ deleted_at: new Date().toISOString(), deleted_by_name: actorName ?? null } as never)
    .in("candidate_id", ids);
  if (error) throw new Error(error.message);
}

/** Restore candidates out of the bin. */
export async function restoreCandidates(ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("candidates")
    .update({ deleted_at: null, deleted_by_name: null } as never)
    .in("candidate_id", ids);
  if (error) throw new Error(error.message);
}

/** Permanently remove candidates (and everything hanging off them). */
export async function purgeCandidates(ids: string[]) {
  if (ids.length === 0) return;
  await supabase.from("document_extractions").delete().in("candidate_id", ids);
  await supabase.from("candidate_documents").delete().in("candidate_id", ids);
  await supabase.from("candidate_scores").delete().in("candidate_id", ids);
  await supabase.from("assessments").delete().in("candidate_id", ids);
  await supabase.from("interviews").delete().in("candidate_id", ids);
  await supabase.from("contracts").delete().in("candidate_id", ids);
  await supabase.from("email_logs").update({ candidate_id: null } as never).in("candidate_id", ids);
  const { error } = await supabase.from("candidates").delete().in("candidate_id", ids);
  if (error) throw new Error(error.message);
}

/** Whole days left before automatic permanent deletion. */
export function daysLeftInBin(deletedAt: string): number {
  const ms = new Date(deletedAt).getTime() + BIN_RETENTION_DAYS * 86_400_000 - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}
