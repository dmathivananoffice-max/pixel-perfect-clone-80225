import { jsonResponse, optionsResponse, readJson } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabase_client.ts";

/** AI score delta endpoint — clamps ±15, refuses DQ transitions (FR-S-05). */
const SUBS = ["fit", "intent", "capability", "timing", "engagement"] as const;

function clampDelta(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(-15, Math.min(15, n));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  try {
    const body = await readJson<{
      lead_id?: string;
      deltas?: Partial<Record<(typeof SUBS)[number], number>>;
    }>(req);
    if (!body.lead_id || !body.deltas) {
      return jsonResponse({ error: "lead_id and deltas required" }, 400);
    }

    const client = createServiceClient();
    const { data: latest, error } = await client
      .schema("growth")
      .from("score")
      .select("*")
      .eq("lead_id", body.lead_id)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!latest) return jsonResponse({ error: "no score for lead" }, 404);

    const { data: weightsRow } = await client
      .schema("growth")
      .from("config")
      .select("value")
      .eq("key", "scoring_weights")
      .eq("active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: bandsRow } = await client
      .schema("growth")
      .from("config")
      .select("value")
      .eq("key", "scoring_bands")
      .eq("active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!weightsRow || !bandsRow) {
      return jsonResponse({ error: "scoring config not seeded" }, 503);
    }

    // Delegate clamp/DQ rules to outbox for worker using shared engine,
    // or compute inline for immediate response:
    const weights = weightsRow.value as {
      version: string;
      weights: Record<string, number>;
    };
    const bands = bandsRow.value as {
      version: string;
      thresholds: { HOT: number; WARM: number; NURTURE: number };
    };

    const clamped: Record<string, number> = {};
    const next: Record<string, number> = {
      fit: Number(latest.fit),
      intent: Number(latest.intent),
      capability: Number(latest.capability),
      timing: Number(latest.timing),
      engagement: Number(latest.engagement),
    };
    for (const k of SUBS) {
      if (body.deltas[k] == null) continue;
      clamped[k] = clampDelta(body.deltas[k]!);
      next[k] = Math.max(0, Math.min(100, Math.round(next[k] + clamped[k])));
    }

    const composite = Math.round(
      next.fit * weights.weights.fit +
        next.intent * weights.weights.intent +
        next.capability * weights.weights.capability +
        next.timing * weights.weights.timing +
        next.engagement * weights.weights.engagement,
    );

    const t = bands.thresholds;
    let nextBand =
      composite >= t.HOT
        ? "HOT"
        : composite >= t.WARM
        ? "WARM"
        : composite >= t.NURTURE
        ? "NURTURE"
        : "DISQUALIFIED";

    // Preserve hard DQ from explanation
    const expl = latest.explanation as { hard_dq_rule?: string | null };
    if (expl?.hard_dq_rule) nextBand = "DISQUALIFIED";

    const priorDq = latest.band === "DISQUALIFIED";
    const nextDq = nextBand === "DISQUALIFIED";
    if (priorDq !== nextDq) {
      return jsonResponse({
        error: priorDq
          ? "AI delta refused: cannot transition out of DISQUALIFIED"
          : "AI delta refused: cannot transition into DISQUALIFIED",
        refused_dq_transition: true,
        clamped,
      }, 409);
    }

    const explanation = {
      ...expl,
      composite,
      band: nextBand,
      ai_proposed: {
        deltas: body.deltas,
        clamped,
        refused_dq_transition: false,
      },
    };

    const { data: saved, error: insErr } = await client
      .schema("growth")
      .from("score")
      .insert({
        lead_id: body.lead_id,
        fit: next.fit,
        intent: next.intent,
        capability: next.capability,
        timing: next.timing,
        engagement: next.engagement,
        composite,
        band: nextBand,
        weights_version: weights.version,
        explanation,
      })
      .select("id, band, composite")
      .single();
    if (insErr) throw insErr;

    return jsonResponse({ ok: true, score: saved, clamped });
  } catch (err) {
    console.error("apply-score-delta failed", err);
    return jsonResponse({ error: "internal error" }, 500);
  }
});
