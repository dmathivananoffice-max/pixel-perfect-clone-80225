import { jsonResponse, optionsResponse, readJson } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabase_client.ts";

type Body = {
  action:
    | "list_intakes"
    | "upsert_intake"
    | "run_governor"
    | "list_states"
    | "resolve_cta";
  id?: string;
  pathway?: string;
  batch_date?: string;
  capacity?: number;
  filled?: number;
  label?: string;
  status?: string;
  updated_by?: string;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthName(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? "the upcoming" : MONTHS[d.getUTCMonth()];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405);

  try {
    const body = await readJson<Body>(req);
    const client = createServiceClient();

    if (body.action === "list_intakes") {
      const { data, error } = await client
        .from("intake")
        .select("*")
        .order("batch_date", { ascending: true });
      if (error) throw error;
      return jsonResponse({ intakes: data ?? [] });
    }

    if (body.action === "upsert_intake") {
      if (!body.pathway || !body.batch_date || body.capacity == null || body.filled == null) {
        return jsonResponse({ error: "pathway, batch_date, capacity, filled required" }, 400);
      }
      if (body.filled > body.capacity) {
        return jsonResponse({ error: "filled cannot exceed capacity" }, 400);
      }
      /**
       * INTEGRATION POINT (platform sync — Phase 2):
       * A sync job should upsert these fields from the Workforce Europe
       * platform API and set synced_at. Manual admin remains the override.
       */
      const row = {
        id: body.id,
        pathway: body.pathway,
        batch_date: body.batch_date,
        capacity: body.capacity,
        filled: body.filled,
        label: body.label ?? null,
        status: body.status ?? "OPEN",
        updated_by: body.updated_by ?? "admin",
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await client
        .from("intake")
        .upsert(row)
        .select("*")
        .single();
      if (error) throw error;
      return jsonResponse({ intake: data }, body.id ? 200 : 201);
    }

    if (body.action === "run_governor" || body.action === "list_states" || body.action === "resolve_cta") {
      // shared compute path
    }

    if (body.action === "run_governor") {
      const states = await computeAndPersist(client);
      return jsonResponse({ states });
    }

    if (body.action === "list_states") {
      const { data, error } = await client
        .from("pathway_capacity_state")
        .select("*")
        .order("pathway");
      if (error) throw error;
      if (!data?.length) {
        const states = await computeAndPersist(client);
        return jsonResponse({ states });
      }
      return jsonResponse({ states: data });
    }

    if (body.action === "resolve_cta") {
      if (!body.pathway) return jsonResponse({ error: "pathway required" }, 400);
      let { data: state } = await client
        .from("pathway_capacity_state")
        .select("*")
        .eq("pathway", body.pathway)
        .maybeSingle();
      if (!state) {
        const states = await computeAndPersist(client);
        state = states.find((s) => s.pathway === body.pathway) ?? null;
      }
      if (state?.waitlist_mode) {
        return jsonResponse({
          cta: {
            mode: "waitlist",
            label: "Join the waitlist",
            copy: state.waitlist_copy,
            intake_id: state.nearest_intake_id,
            pathway_throttled: state.pathway_throttled,
            dashboard_flagged: state.dashboard_flagged,
          },
        });
      }
      return jsonResponse({
        cta: {
          mode: "open",
          label: "Continue",
          copy: state?.nearest_batch_date
            ? `Continue for the ${monthName(state.nearest_batch_date)} intake — get this plan on WhatsApp and speak with an advisor.`
            : "Continue to get this plan on WhatsApp and speak with an advisor.",
          intake_id: state?.nearest_intake_id ?? null,
          pathway_throttled: false,
          dashboard_flagged: Boolean(state?.dashboard_flagged),
        },
      });
    }

    return jsonResponse({ error: "unknown action" }, 400);
  } catch (err) {
    console.error("capacity-governor failed", err);
    return jsonResponse({ error: "internal error" }, 500);
  }
});

async function computeAndPersist(client: ReturnType<typeof createServiceClient>) {
  const { data: cfgRow } = await client
    .from("config")
    .select("value")
    .eq("key", "capacity_governor")
    .eq("active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const threshold = Number(cfgRow?.value?.fill_threshold ?? 0.85);
  const pathways: string[] = cfgRow?.value?.pathways ?? [
    "nursing-professional",
    "nursing-ausbildung",
  ];

  const { data: intakes, error } = await client.from("intake").select("*");
  if (error) throw error;
  const today = new Date().toISOString().slice(0, 10);
  const states = [];

  for (const pathway of pathways) {
    const open = (intakes ?? [])
      .filter(
        (i: { pathway: string; status: string; batch_date: string }) =>
          i.pathway === pathway &&
          (i.status === "OPEN" || i.status === "WAITLIST") &&
          i.batch_date >= today,
      )
      .sort((a: { batch_date: string }, b: { batch_date: string }) =>
        a.batch_date.localeCompare(b.batch_date),
      );
    const nearest = open[0] ?? null;
    const next = open[1] ?? null;
    const ratio = nearest
      ? Math.min(1, nearest.filled / Math.max(nearest.capacity, 1))
      : 0;
    const over = Boolean(nearest && ratio >= threshold);
    const waitlist_copy = over
      ? `The ${monthName(nearest.batch_date)} intake is full — join the list for ${
          next ? monthName(next.batch_date) : "the following intake"
        }`
      : null;
    const state = {
      pathway,
      nearest_intake_id: nearest?.id ?? null,
      next_intake_id: next?.id ?? null,
      fill_ratio: Number(ratio.toFixed(4)),
      threshold,
      pathway_throttled: over,
      waitlist_mode: over,
      dashboard_flagged: over,
      waitlist_copy,
      nearest_batch_date: nearest?.batch_date ?? null,
      next_batch_date: next?.batch_date ?? null,
      computed_at: new Date().toISOString(),
      meta: {
        capacity: nearest?.capacity ?? null,
        filled: nearest?.filled ?? null,
        signals: { pathway_throttled: over, waitlist_mode: over },
      },
    };
    states.push(state);
    const { error: upErr } = await client
      .from("pathway_capacity_state")
      .upsert(state);
    if (upErr) throw upErr;
    if (nearest && over && nearest.status === "OPEN") {
      await client.from("intake").update({ status: "WAITLIST" }).eq("id", nearest.id);
    }
  }
  return states;
}
