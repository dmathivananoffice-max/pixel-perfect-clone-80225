import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/** Insert a pg-boss trigger row for the growth worker to drain. */
export async function enqueueOutbox(
  client: SupabaseClient,
  job_name: string,
  payload: Record<string, unknown>,
  singleton_key?: string,
): Promise<void> {
  const { error } = await client.schema("growth").from("job_outbox").insert({
    job_name,
    payload,
    singleton_key: singleton_key ?? null,
  });
  if (error) throw error;
}
