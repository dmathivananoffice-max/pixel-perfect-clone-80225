import { eraseLead } from "../_shared/lead/erase.ts";
import type { EraseLeadRequest } from "../_shared/lead/types.ts";
import { createSupabaseLeadRepo } from "../_shared/lead/supabase_repo.ts";
import { jsonResponse, optionsResponse, readJson } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabase_client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  try {
    const body = await readJson<EraseLeadRequest>(req);
    if (!body?.lead_id && !body?.phone) {
      return jsonResponse(
        { error: "lead_id or phone is required" },
        400,
      );
    }

    const repo = createSupabaseLeadRepo(createServiceClient());
    const outcome = await eraseLead(repo, body);

    if (!outcome.ok) {
      return jsonResponse({ error: outcome.error.error }, outcome.error.status);
    }
    return jsonResponse(outcome.result, 200);
  } catch (err) {
    console.error("erase-lead failed", err);
    return jsonResponse({ error: "internal error" }, 500);
  }
});
