import { evaluateDiagnostic } from "../_shared/diagnostic/engine.ts";
import { loadRules, writeDiagEvent } from "../_shared/diagnostic/sessionDb.ts";
import { jsonResponse, optionsResponse, readJson } from "../_shared/http.ts";
import { enqueueOutbox } from "../_shared/jobOutbox.ts";
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

    if (body.action === "start" || body.action === "answer") {
      const { error } = await client.schema("growth").from("diagnostic_session").upsert(
        {
          id: body.session_id,
          branch: body.branch ?? "unknown",
          answers,
          rules_version: "pending",
          ...(body.action === "start" ? { started_at: now } : {}),
          updated_at: now,
          last_question_index: body.question_index ?? 0,
          last_question_id: body.question_id ?? null,
        },
        { onConflict: "id" },
      );
      if (error) throw error;
      await writeDiagEvent(client, {
        session_id: body.session_id,
        type: body.action === "start" ? "DIAG_START" : "DIAG_QUESTION_ANSWERED",
        meta: body.action === "start"
          ? { branch: body.branch ?? null }
          : {
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
        ? evaluateDiagnostic({ branch: body.branch, answers, rules })
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
      await writeDiagEvent(client, {
        session_id: body.session_id,
        type: "DIAG_COMPLETE",
        meta: {
          band: (result as { band?: string } | null)?.band ?? null,
          rules_version:
            (result as { rules_version?: string } | null)?.rules_version ?? null,
        },
      });
      await enqueueOutbox(
        client,
        "growth.score.recompute",
        {
          trigger: "diagnostic_completion",
          session_id: body.session_id,
          branch: body.branch,
          answers,
        },
        `recompute:${body.session_id}:diagnostic_completion`,
      );
      return jsonResponse({ ok: true, result });
    }

    if (body.action === "contact") {
      const { error } = await client
        .schema("growth")
        .from("diagnostic_session")
        .update({ lead_id: body.lead_id ?? null, updated_at: now })
        .eq("id", body.session_id);
      if (error) throw error;
      await writeDiagEvent(client, {
        session_id: body.session_id,
        lead_id: body.lead_id,
        type: "DIAG_CONTACT_CAPTURED",
      });
      if (body.lead_id) {
        await enqueueOutbox(
          client,
          "growth.score.recompute",
          {
            trigger: "contact_capture",
            lead_id: body.lead_id,
            session_id: body.session_id,
            branch: body.branch,
            answers,
          },
          `recompute:${body.lead_id}:contact_capture`,
        );
      }
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "unknown action" }, 400);
  } catch (err) {
    console.error("diagnostic-session failed", err);
    return jsonResponse({ error: "internal error" }, 500);
  }
});
