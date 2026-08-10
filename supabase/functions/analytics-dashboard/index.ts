import { jsonResponse, optionsResponse, readJson } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabase_client.ts";

type Body = {
  action: "home" | "funnel" | "leads" | "run_rollup" | "counsellor_outcome" | "coverage";
  role?: string;
  pathway?: string;
  source?: string;
  lead_id?: string;
  outcome?: string;
  logged_by?: string;
  note?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405);

  try {
    const body = await readJson<Body>(req);
    const client = createServiceClient();
    const role = body.role ?? "marketing_operator";

    // FR-DB-06: counsellors → leads only
    if (role === "counsellor" && body.action !== "leads" && body.action !== "counsellor_outcome") {
      return jsonResponse({ error: "Your role can only view Leads." }, 403);
    }

    if (body.action === "run_rollup") {
      const { data, error } = await client.rpc("refresh_funnel_daily_rollup", {
        p_days: 14,
      });
      if (error) throw error;
      return jsonResponse({ ok: true, rows: data });
    }

    if (body.action === "counsellor_outcome") {
      if (!body.lead_id || !body.outcome || !body.logged_by) {
        return jsonResponse({ error: "lead_id, outcome, logged_by required" }, 400);
      }
      const stage =
        body.outcome === "COUNSELLING_ATTENDED"
          ? "attended"
          : body.outcome === "APPLICATION_SUBMITTED"
            ? "application"
            : "paid";
      const { data, error } = await client.from("funnel_event").insert({
        lead_id: body.lead_id,
        type: body.outcome,
        stage,
        meta: {
          stub_manual: true,
          logged_by: body.logged_by,
          note: body.note,
          pathway: body.pathway,
        },
      }).select("*").single();
      if (error) throw error;
      return jsonResponse({ event: data }, 201);
    }

    if (body.action === "coverage") {
      return jsonResponse({
        coverage: {
          live: [
            "DIAG_START", "DIAG_QUESTION_ANSWERED", "DIAG_COMPLETE", "DIAG_ABANDONED",
            "LEAD_CREATED", "LEAD_RETURNED", "DIAG_CONTACT_CAPTURED",
            "BAND_ASSIGNED", "BAND_CHANGED", "BOOKING_CREATED",
          ],
          stub_manual: ["COUNSELLING_ATTENDED", "APPLICATION_SUBMITTED", "PAID"],
        },
      });
    }

    if (body.action === "home") {
      const today = new Date().toISOString().slice(0, 10);
      const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const { data: roll } = await client
        .from("funnel_daily_rollup")
        .select("*")
        .gte("day", y);
      const sum = (day: string, types: string[]) =>
        (roll ?? [])
          .filter((r: { day: string; event_type: string }) =>
            r.day === day && types.includes(r.event_type))
          .reduce((n: number, r: { event_count: number }) => n + Number(r.event_count), 0);
      const { data: llm } = await client.from("llm_daily_rollup").select("*").gte("day", today.slice(0, 7) + "-01");
      const { data: alerts } = await client
        .from("dashboard_alert")
        .select("*")
        .eq("active", true);
      return jsonResponse({
        home: {
          today: {
            leads: sum(today, ["LEAD_CREATED", "LEAD_RETURNED"]),
            mqls: sum(today, ["BAND_ASSIGNED", "BAND_CHANGED"]),
            bookings: sum(today, ["BOOKING_CREATED"]),
            spend: 0,
          },
          yesterday: {
            leads: sum(y, ["LEAD_CREATED", "LEAD_RETURNED"]),
            mqls: sum(y, ["BAND_ASSIGNED", "BAND_CHANGED"]),
            bookings: sum(y, ["BOOKING_CREATED"]),
            spend: 0,
          },
          alerts: alerts ?? [],
          llm_today_eur: (llm ?? [])
            .filter((r: { day: string }) => r.day === today)
            .reduce((n: number, r: { cost_eur: number }) => n + Number(r.cost_eur), 0),
          llm_month_eur: (llm ?? []).reduce(
            (n: number, r: { cost_eur: number }) => n + Number(r.cost_eur),
            0,
          ),
          envelope_eur: 300,
        },
      });
    }

    if (body.action === "funnel") {
      let q = client.from("funnel_daily_rollup").select("*");
      if (body.pathway) q = q.eq("pathway", body.pathway);
      if (body.source) q = q.eq("source", body.source);
      const { data: roll } = await q;
      const { data: drop } = await client
        .from("diag_dropoff_rollup")
        .select("*")
        .order("question_index");
      return jsonResponse({ funnel: { rollups: roll ?? [], dropoff: drop ?? [] } });
    }

    if (body.action === "leads") {
      const { data: scores } = await client
        .from("score")
        .select("lead_id, band, computed_at, explanation")
        .order("computed_at", { ascending: false })
        .limit(500);
      const bands: Record<string, number> = {
        HOT: 0, WARM: 0, NURTURE: 0, DISQUALIFIED: 0,
      };
      for (const s of scores ?? []) bands[s.band] = (bands[s.band] ?? 0) + 1;
      return jsonResponse({
        leads: {
          bands,
          hot_queue: (scores ?? [])
            .filter((s: { band: string }) => s.band === "HOT")
            .slice(0, 50),
          dq_reasons: [],
        },
      });
    }

    return jsonResponse({ error: "unknown action" }, 400);
  } catch (err) {
    console.error("analytics-dashboard failed", err);
    return jsonResponse({ error: "internal error" }, 500);
  }
});
