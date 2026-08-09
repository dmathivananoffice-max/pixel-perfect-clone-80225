import { captureLead } from "../_shared/lead/capture.ts";
import type { CaptureLeadRequest } from "../_shared/lead/types.ts";
import { createSupabaseLeadRepo } from "../_shared/lead/supabase_repo.ts";
import { jsonResponse, optionsResponse, readJson } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabase_client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  try {
    const body = await readJson<CaptureLeadRequest>(req);
    if (!body?.consent) {
      return jsonResponse({ error: "consent is required" }, 400);
    }

    const repo = createSupabaseLeadRepo(createServiceClient());
    const outcome = await captureLead(repo, body);

    if (!outcome.ok) {
      return jsonResponse({ error: outcome.error.error }, outcome.error.status);
    }
    return jsonResponse(outcome.result, outcome.result.created ? 201 : 200);
  } catch (err) {
    console.error("capture-lead failed", err);
    return jsonResponse({ error: "internal error" }, 500);
  }
});
