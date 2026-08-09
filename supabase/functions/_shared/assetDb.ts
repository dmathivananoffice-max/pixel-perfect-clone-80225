import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const ASSET_COLS =
  "id, type, title, version, status, claim_bearing, body_ref, body, claim_checklist, question_patterns, answer_text, approved_by, approved_at, reviewed_by, reviewed_at, review_comment, submitted_by, submitted_at, created_by, parent_asset_id, version_hash, created_at, updated_at";

export async function getAsset(client: SupabaseClient, id: string) {
  const { data, error } = await client
    .schema("growth")
    .from("asset")
    .select(ASSET_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
