import { jsonResponse, optionsResponse, readJson } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabase_client.ts";

/**
 * Counsellor band override — reason_code required (FR-S-06).
 * Body: { lead_id, to_band, reason_code, by_user }
 */
const REASON_CODES = [
  "COUNSELLOR_JUDGEMENT",
  "DATA_CORRECTION",
  "FAMILY_CONTEXT",
  "DOCUMENT_VERIFIED",
  "OTHER",
] as const;

const BANDS = ["HOT", "WARM", "NURTURE", "DISQUALIFIED"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  try {
    const body = await readJson<{
      lead_id?: string;
      to_band?: string;
      reason_code?: string;
      by_user?: string;
    }>(req);

    if (!body.lead_id || !body.to_band || !body.by_user) {
      return jsonResponse(
        { error: "lead_id, to_band, and by_user are required" },
        400,
      );
    }
    if (!body.reason_code?.trim()) {
      return jsonResponse({ error: "reason_code is required" }, 400);
    }
    if (!REASON_CODES.includes(body.reason_code as typeof REASON_CODES[number])) {
      return jsonResponse({
        error: `reason_code must be one of: ${REASON_CODES.join(", ")}`,
      }, 400);
    }
    if (!BANDS.includes(body.to_band as typeof BANDS[number])) {
      return jsonResponse({ error: "invalid to_band" }, 400);
    }

    const client = createServiceClient();
    const { data: latest, error: sErr } = await client
      .schema("growth")
      .from("score")
      .select("id, band, fit, intent, capability, timing, engagement, composite, weights_version, explanation")
      .eq("lead_id", body.lead_id)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!latest) return jsonResponse({ error: "no score for lead" }, 404);

    const from_band = latest.band as string;
    if (from_band === body.to_band) {
      return jsonResponse({ error: "to_band must differ from from_band" }, 400);
    }

    const { error: oErr } = await client.schema("growth").from("score_override").insert({
      lead_id: body.lead_id,
      by_user: body.by_user,
      from_band,
      to_band: body.to_band,
      reason_code: body.reason_code,
    });
    if (oErr) throw oErr;

    const explanation = {
      ...(latest.explanation as Record<string, unknown>),
      band: body.to_band,
      override: {
        reason_code: body.reason_code,
        by_user: body.by_user,
        from_band,
      },
    };

    const { data: score, error: insErr } = await client
      .schema("growth")
      .from("score")
      .insert({
        lead_id: body.lead_id,
        fit: latest.fit,
        intent: latest.intent,
        capability: latest.capability,
        timing: latest.timing,
        engagement: latest.engagement,
        composite: latest.composite,
        band: body.to_band,
        weights_version: latest.weights_version,
        explanation,
      })
      .select("id, band")
      .single();
    if (insErr) throw insErr;

    // Transition side-effects via outbox → pg-boss
    if (body.to_band === "HOT" && from_band !== "HOT") {
      await client.schema("growth").from("job_outbox").insert({
        job_name: "growth.counsellor_task",
        payload: {
          lead_id: body.lead_id,
          from_band,
          to_band: "HOT",
          sla_business_hours: 4,
          score_id: score.id,
        },
      });
    }
    if (body.to_band === "DISQUALIFIED" && from_band !== "DISQUALIFIED") {
      await client.schema("growth").from("job_outbox").insert({
        job_name: "growth.dq_message",
        payload: {
          lead_id: body.lead_id,
          from_band,
          to_band: "DISQUALIFIED",
          asset_ref: "asset:dq_respectful_v1",
          exclude_from_retargeting: true,
        },
      });
    }

    return jsonResponse({ ok: true, score_id: score.id, band: score.band });
  } catch (err) {
    console.error("override-score failed", err);
    return jsonResponse({ error: "internal error" }, 500);
  }
});
