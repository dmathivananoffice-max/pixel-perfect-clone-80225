import { evaluateDiagnostic } from "../_shared/diagnostic/engine.ts";
import type { DiagnosticRulesConfig } from "../_shared/diagnostic/engine.ts";
import { jsonResponse, optionsResponse, readJson } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabase_client.ts";

type Body = {
  action: "start" | "answer" | "complete" | "contact" | "abandon_check";
  session_id: string;
  branch?: string | null;
  answers?: Record<string, string>;
  question_index?: number;
  question_id?: string;
  result?: Record<string, unknown> | null;
  lead_id?: string | null;
};

async function loadRules(
  client: ReturnType<typeof createServiceClient>,
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

async function writeEvent(
  client: ReturnType<typeof createServiceClient>,
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  try {
    const body = await readJson<Body>(req);
    if (!body?.session_id || !body.action) {
      return jsonResponse({ error: "session_id and action required" }, 400);
    }

    const client = createServiceClient();

    if (body.action === "abandon_check") {
      const { data, error } = await client.rpc(
        "mark_abandoned_diagnostic_sessions",
        { stale_after: "30 minutes" },
      );
      if (error) throw error;
      return jsonResponse({ abandoned: data ?? 0 });
    }

    const answers = body.answers ?? {};
    const now = new Date().toISOString();

    if (body.action === "start") {
      const { error } = await client.schema("growth").from("diagnostic_session").upsert(
        {
          id: body.session_id,
          branch: body.branch ?? "unknown",
          answers,
          rules_version: "pending",
          started_at: now,
          updated_at: now,
          last_question_index: body.question_index ?? 0,
          last_question_id: body.question_id ?? null,
        },
        { onConflict: "id" },
      );
      if (error) throw error;
      await writeEvent(client, {
        session_id: body.session_id,
        type: "DIAG_START",
        meta: { branch: body.branch ?? null },
      });
      return jsonResponse({ ok: true });
    }

    if (body.action === "answer") {
      const { error } = await client.schema("growth").from("diagnostic_session").upsert(
        {
          id: body.session_id,
          branch: body.branch ?? "unknown",
          answers,
          rules_version: "pending",
          updated_at: now,
          last_question_index: body.question_index ?? 0,
          last_question_id: body.question_id ?? null,
        },
        { onConflict: "id" },
      );
      if (error) throw error;
      await writeEvent(client, {
        session_id: body.session_id,
        type: "DIAG_QUESTION_ANSWERED",
        meta: {
          question_index: body.question_index ?? 0,
          question_id: body.question_id ?? null,
        },
      });
      return jsonResponse({ ok: true });
    }

    if (body.action === "complete") {
      if (!body.branch) {
        return jsonResponse({ error: "branch required" }, 400);
      }
      const rules = await loadRules(client, body.branch);
      const result = rules
        ? evaluateDiagnostic({
          branch: body.branch,
          answers,
          rules,
        })
        : body.result;

      const { error } = await client.schema("growth").from("diagnostic_session").upsert(
        {
          id: body.session_id,
          branch: body.branch,
          answers,
          result,
          rules_version:
            (result as { rules_version?: string } | null)?.rules_version ??
              "client",
          completed_at: now,
          updated_at: now,
          last_question_index: body.question_index ?? null,
          last_question_id: body.question_id ?? null,
        },
        { onConflict: "id" },
      );
      if (error) throw error;
      await writeEvent(client, {
        session_id: body.session_id,
        type: "DIAG_COMPLETE",
        meta: {
          band: (result as { band?: string } | null)?.band ?? null,
          rules_version:
            (result as { rules_version?: string } | null)?.rules_version ?? null,
        },
      });
      return jsonResponse({ ok: true, result });
    }

    if (body.action === "contact") {
      const { error } = await client
        .schema("growth")
        .from("diagnostic_session")
        .update({
          lead_id: body.lead_id ?? null,
          updated_at: now,
        })
        .eq("id", body.session_id);
      if (error) throw error;
      await writeEvent(client, {
        session_id: body.session_id,
        lead_id: body.lead_id,
        type: "DIAG_CONTACT_CAPTURED",
      });
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "unknown action" }, 400);
  } catch (err) {
    console.error("diagnostic-session failed", err);
    return jsonResponse({ error: "internal error" }, 500);
  }
});
