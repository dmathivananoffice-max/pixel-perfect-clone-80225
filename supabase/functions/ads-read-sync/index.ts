/**
 * Edge entry for M13 READ-only ads sync (FR-AD-01/04).
 * Does not accept pause/create/update/budget actions.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
    };
    // Reject any write-shaped actions explicitly
    const banned = [
      "pause",
      "create",
      "update",
      "resume",
      "set_budget",
      "mutate",
      "upload_conversion",
    ];
    if (body.action && banned.includes(body.action)) {
      return new Response(
        JSON.stringify({
          error:
            "Write actions are not available on ads-read-sync. Phase 2 executor only.",
          write_scopes: "none",
        }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(url, key, { db: { schema: "growth" } });

    if (body.action === "campaigns" || !body.action) {
      const { data: accounts } = await client.from("ad_account").select("*");
      const { data: entities } = await client.from("ad_entity").select("*");
      const { data: metrics } = await client.from("campaign_metric").select("*");
      const { data: alerts } = await client
        .from("dashboard_alert")
        .select("*")
        .eq("active", true)
        .in("code", ["UTM_MISSING", "UTM_MALFORMED"]);

      const today = new Date().toISOString().slice(0, 10);
      const campaignIds = new Set(
        (entities ?? [])
          .filter((e: { level: string }) => e.level === "campaign")
          .map((e: { id: string }) => e.id),
      );
      const spend_today_eur = (metrics ?? [])
        .filter(
          (m: { date: string; ad_entity_id: string }) =>
            m.date === today && campaignIds.has(m.ad_entity_id),
        )
        .reduce(
          (n: number, m: { spend_eur: number }) => n + Number(m.spend_eur),
          0,
        );

      return new Response(
        JSON.stringify({
          spend_today_eur,
          accounts: accounts ?? [],
          entities: entities ?? [],
          metrics: metrics ?? [],
          utm_alerts: alerts ?? [],
          write_scopes: "none",
        }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "unknown action", write_scopes: "none" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
