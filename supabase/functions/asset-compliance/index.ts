import { ASSET_COLS, getAsset } from "../_shared/assetDb.ts";
import { jsonResponse, optionsResponse, readJson } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabase_client.ts";

type Body = {
  action:
    | "create"
    | "submit"
    | "review"
    | "retire"
    | "list_in_review"
    | "get"
    | "resolve";
  asset_id?: string;
  type?: string;
  title?: string;
  body?: Record<string, unknown>;
  body_ref?: string;
  claim_bearing?: boolean;
  question_patterns?: string[];
  answer_text?: string;
  claim_checklist?: Record<string, unknown>;
  actor_id?: string;
  decision?: "approve" | "reject";
  comment?: string;
  parent_asset_id?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  try {
    const body = await readJson<Body>(req);
    const client = createServiceClient();
    const now = new Date().toISOString();

    if (body.action === "list_in_review") {
      const { data, error } = await client
        .schema("growth")
        .from("asset")
        .select(ASSET_COLS)
        .eq("status", "IN_REVIEW")
        .order("submitted_at", { ascending: true });
      if (error) throw error;
      return jsonResponse({ assets: data ?? [] });
    }

    if (body.action === "get") {
      if (!body.asset_id) return jsonResponse({ error: "asset_id required" }, 400);
      const data = await getAsset(client, body.asset_id);
      if (!data) return jsonResponse({ error: "not found" }, 404);
      const prior = data.parent_asset_id
        ? await getAsset(client, data.parent_asset_id)
        : null;
      return jsonResponse({ asset: data, prior });
    }

    if (body.action === "create") {
      if (!body.type || !body.title) {
        return jsonResponse({ error: "type and title required" }, 400);
      }
      const faqBody = {
        ...(body.body ?? {}),
        question_patterns: body.question_patterns ?? [],
        answer_text: body.answer_text ?? "",
      };
      const { data, error } = await client.schema("growth").from("asset").insert({
        type: body.type,
        title: body.title,
        status: "DRAFT",
        claim_bearing: body.claim_bearing ?? true,
        body_ref: body.body_ref ?? `asset:${body.type.toLowerCase()}`,
        body: body.type === "FAQ_ANSWER" ? faqBody : (body.body ?? {}),
        question_patterns: body.question_patterns ?? [],
        answer_text: body.answer_text ?? null,
        created_by: body.actor_id ?? null,
        parent_asset_id: body.parent_asset_id ?? null,
        claim_checklist: {},
      }).select(ASSET_COLS).single();
      if (error) throw error;
      return jsonResponse({ asset: data }, 201);
    }

    if (body.action === "submit") {
      if (!body.asset_id || !body.actor_id || !body.claim_checklist) {
        return jsonResponse({ error: "asset_id, actor_id, claim_checklist required" }, 400);
      }
      const { data, error } = await client.schema("growth").from("asset").update({
        status: "IN_REVIEW",
        claim_checklist: body.claim_checklist,
        submitted_by: body.actor_id,
        submitted_at: now,
        review_comment: null,
        updated_at: now,
      }).eq("id", body.asset_id).in("status", ["DRAFT", "REJECTED"])
        .select(ASSET_COLS).maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse({ error: "not submittable" }, 409);
      return jsonResponse({ asset: data });
    }

    if (body.action === "review") {
      if (!body.asset_id || !body.actor_id || !body.decision) {
        return jsonResponse({ error: "asset_id, actor_id, decision required" }, 400);
      }
      if (body.decision === "reject" && !body.comment?.trim()) {
        return jsonResponse({ error: "reject requires comment" }, 400);
      }
      const approved = body.decision === "approve";
      const { data, error } = await client.schema("growth").from("asset").update({
        status: approved ? "APPROVED" : "REJECTED",
        approved_by: approved ? body.actor_id : null,
        approved_at: approved ? now : null,
        reviewed_by: body.actor_id,
        reviewed_at: now,
        review_comment: body.comment ?? null,
        claim_checklist: body.claim_checklist,
        updated_at: now,
      }).eq("id", body.asset_id).eq("status", "IN_REVIEW")
        .select(ASSET_COLS).maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse({ error: "not in review" }, 409);
      return jsonResponse({ asset: data });
    }

    if (body.action === "retire") {
      if (!body.asset_id) return jsonResponse({ error: "asset_id required" }, 400);
      const { data: refs, error: rErr } = await client
        .schema("growth")
        .rpc("asset_active_sequence_refs", { p_asset_id: body.asset_id });
      if (rErr) throw rErr;
      const ids = (refs ?? []).map((r: { sequence_id: string }) => r.sequence_id);
      if (ids.length > 0) {
        return jsonResponse({
          error: `FR-P-04: cannot retire; active sequences: ${ids.join(", ")}`,
          sequence_ids: ids,
        }, 409);
      }
      const { data, error } = await client.schema("growth").from("asset").update({
        status: "RETIRED",
        updated_at: now,
      }).eq("id", body.asset_id).neq("status", "RETIRED")
        .select(ASSET_COLS).maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse({ error: "not found or already retired" }, 404);
      return jsonResponse({ asset: data });
    }

    if (body.action === "resolve") {
      if (!body.asset_id) return jsonResponse({ error: "asset_id required" }, 400);
      const data = await getAsset(client, body.asset_id);
      if (!data || data.status !== "APPROVED") {
        return jsonResponse({
          error: `G-2 send path refused: asset ${body.asset_id} status=${data?.status ?? "MISSING"} (APPROVED required)`,
        }, 409);
      }
      return jsonResponse({ asset: data });
    }

    return jsonResponse({ error: "unknown action" }, 400);
  } catch (err) {
    console.error("asset-compliance failed", err);
    return jsonResponse({ error: "internal error" }, 500);
  }
});
