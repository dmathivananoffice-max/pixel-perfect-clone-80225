import type { DiagnosticRulesConfig } from "./engine.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export async function loadRules(
  client: SupabaseClient,
  branch: string,
): Promise<DiagnosticRulesConfig | null> {
  const { data, error } = await client
    .schema("growth")
    .from("config")
    .select("value")
    .eq("key", `diagnostic_rules:${branch}`)
    .eq("active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.value as DiagnosticRulesConfig;
}

export async function writeDiagEvent(
  client: SupabaseClient,
  input: {
    session_id: string;
    lead_id?: string | null;
    type: string;
    meta?: Record<string, unknown>;
  },
) {
  const { error } = await client.schema("growth").from("funnel_event").insert({
    session_id: input.session_id,
    lead_id: input.lead_id ?? null,
    type: input.type,
    stage: "diagnostic",
    meta: input.meta ?? {},
    at: new Date().toISOString(),
  });
  if (error) throw error;
}
