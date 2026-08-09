import { createServiceClient } from "../_shared/supabase_client.ts";
import { jsonResponse, optionsResponse } from "../_shared/http.ts";
import { handleEdgeInbound } from "../_shared/whatsapp/edgeConversation.ts";
import { parseInboundMessages } from "../_shared/whatsapp/parseWebhook.ts";

/**
 * Meta WhatsApp Business Cloud API webhook (M4).
 * GET — hub verification; POST — inbound messages → conversation loop.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const expected = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "wfe-wa-verify";
    if (mode === "subscribe" && token === expected && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return jsonResponse({ error: "verification failed" }, 403);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  try {
    const payload = await req.json();
    const messages = parseInboundMessages(payload);
    if (messages.length === 0) {
      return jsonResponse({ ok: true, handled: 0 });
    }

    const client = createServiceClient();
    const results = [];
    for (const msg of messages) {
      results.push(
        await handleEdgeInbound(client, { from: msg.from, text: msg.text }),
      );
    }
    return jsonResponse({ ok: true, handled: results.length, results });
  } catch (err) {
    console.error("whatsapp-webhook failed", err);
    return jsonResponse({ error: "internal error" }, 500);
  }
});
