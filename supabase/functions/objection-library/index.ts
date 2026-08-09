import { jsonResponse, optionsResponse, readJson } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabase_client.ts";
import { metaSendTemplate, metaSendText } from "../_shared/whatsapp/metaSend.ts";

type Body = {
  action:
    | "log"
    | "list_recent"
    | "list_mappings"
    | "upsert_mapping"
    | "trends"
    | "dispatch_exit_surveys"
    | "answer_exit_survey";
  lead_id?: string;
  source?: string;
  taxonomy_code?: string;
  verbatim?: string;
  logged_by?: string;
  pathway?: string;
  session_id?: string;
  meta?: Record<string, unknown>;
  limit?: number;
  weeks?: number;
  code?: string;
  label?: string;
  underlying_fear?: string;
  evidence_type?: string;
  approved_asset_refs?: string[];
  talk_track?: string;
  active?: boolean;
  updated_by?: string;
  reply?: string;
};

const EXIT_MAP: Record<string, string> = {
  "1": "COST",
  "2": "TRUST/FRAUD-FEAR",
  "3": "VISA-RISK",
  "4": "LANGUAGE-DIFFICULTY",
  "5": "PARENT-APPROVAL",
  "6": "RECOGNITION-RISK",
  "7": "TIMELINE",
  "8": "COMPETITOR-COMPARISON",
  "9": "SAFETY-ABROAD",
  "10": "SELF-DOUBT",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405);

  try {
    const body = await readJson<Body>(req);
    const client = createServiceClient();

    if (body.action === "log") {
      if (!body.taxonomy_code || !body.logged_by) {
        return jsonResponse({ error: "taxonomy_code and logged_by required" }, 400);
      }
      const { data, error } = await client.from("objection").insert({
        lead_id: body.lead_id ?? null,
        source: body.source ?? "counsellor",
        verbatim: body.verbatim?.trim() || `(${body.taxonomy_code})`,
        taxonomy_code: body.taxonomy_code,
        logged_by: body.logged_by,
        pathway: body.pathway ?? null,
        session_id: body.session_id ?? null,
        meta: body.meta ?? {},
      }).select("*").single();
      if (error) throw error;
      return jsonResponse({ objection: data }, 201);
    }

    if (body.action === "list_recent") {
      const { data, error } = await client
        .from("objection")
        .select("*")
        .order("at", { ascending: false })
        .limit(body.limit ?? 20);
      if (error) throw error;
      return jsonResponse({ objections: data ?? [] });
    }

    if (body.action === "list_mappings") {
      const { data, error } = await client
        .from("objection_taxonomy_map")
        .select("*")
        .order("code");
      if (error) throw error;
      return jsonResponse({ mappings: data ?? [] });
    }

    if (body.action === "upsert_mapping") {
      if (!body.code || !body.updated_by) {
        return jsonResponse({ error: "code and updated_by required" }, 400);
      }
      const { data, error } = await client.from("objection_taxonomy_map").upsert({
        code: body.code,
        label: body.label ?? body.code,
        underlying_fear: body.underlying_fear ?? "",
        evidence_type: body.evidence_type ?? "",
        approved_asset_refs: body.approved_asset_refs ?? [],
        talk_track: body.talk_track ?? "",
        active: body.active ?? true,
        updated_by: body.updated_by,
        updated_at: new Date().toISOString(),
      }).select("*").single();
      if (error) throw error;
      return jsonResponse({ mapping: data });
    }

    if (body.action === "trends") {
      const { data, error } = await client.rpc("objection_trends", {
        p_weeks: body.weeks ?? 8,
        p_pathway: body.pathway ?? null,
      });
      if (error) throw error;
      return jsonResponse({ trends: data ?? [] });
    }

    if (body.action === "dispatch_exit_surveys") {
      const { data: cands, error } = await client.rpc("exit_survey_candidates", {
        p_limit: body.limit ?? 50,
      });
      if (error) throw error;
      const token = Deno.env.get("WHATSAPP_TOKEN") ?? Deno.env.get("META_WA_TOKEN");
      const phoneNumberId =
        Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ??
        Deno.env.get("META_WA_PHONE_NUMBER_ID");
      let sent = 0;
      for (const c of cands ?? []) {
        const { data: tpl } = await client
          .from("wa_template")
          .select("*")
          .eq("name", "diag_exit_survey")
          .maybeSingle();
        if (token && phoneNumberId && tpl) {
          try {
            await metaSendTemplate({
              token,
              phoneNumberId,
              to: c.phone_e164,
              templateName: tpl.meta_template_name,
            });
          } catch {
            await metaSendText({
              token,
              phoneNumberId,
              to: c.phone_e164,
              text: tpl.body,
            });
          }
        }
        await client.from("exit_survey_dispatch").insert({
          session_id: c.session_id,
          lead_id: c.lead_id,
          pathway: c.pathway,
          status: "SENT",
        });
        sent += 1;
      }
      return jsonResponse({ sent, candidates: (cands ?? []).length });
    }

    if (body.action === "answer_exit_survey") {
      if (!body.lead_id || !body.reply) {
        return jsonResponse({ error: "lead_id and reply required" }, 400);
      }
      const code =
        EXIT_MAP[body.reply.trim()] ??
        (body.reply.trim().toUpperCase().includes("COST") ? "COST" : null) ??
        body.taxonomy_code;
      if (!code) return jsonResponse({ error: "unrecognised reply" }, 400);
      const { data, error } = await client.from("objection").insert({
        lead_id: body.lead_id,
        source: "diag_exit_survey",
        verbatim: body.reply.trim(),
        taxonomy_code: code,
        logged_by: "diag_exit_survey",
        pathway: body.pathway ?? null,
        session_id: body.session_id ?? null,
        meta: { exit_survey: true },
      }).select("*").single();
      if (error) throw error;
      if (body.session_id) {
        await client.from("exit_survey_dispatch").update({
          status: "ANSWERED",
          answered_at: new Date().toISOString(),
          objection_id: data.id,
        }).eq("session_id", body.session_id);
      }
      return jsonResponse({ objection: data }, 201);
    }

    return jsonResponse({ error: "unknown action" }, 400);
  } catch (err) {
    console.error("objection-library failed", err);
    return jsonResponse({ error: "internal error" }, 500);
  }
});
