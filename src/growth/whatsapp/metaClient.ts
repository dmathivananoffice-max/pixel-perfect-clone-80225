/** Meta WhatsApp Business Cloud API client (FR-W-06 messaging layer). */

export type MetaConfig = {
  token: string;
  phoneNumberId: string;
  apiVersion?: string;
};

export type MetaSendResult = { message_id: string };

export function loadMetaConfigFromEnv(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): MetaConfig | null {
  const token = env.WHATSAPP_TOKEN ?? env.META_WA_TOKEN;
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID ?? env.META_WA_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return null;
  return {
    token,
    phoneNumberId,
    apiVersion: env.WHATSAPP_API_VERSION ?? "v21.0",
  };
}

export function createMetaClient(
  config: MetaConfig,
  fetchImpl: typeof fetch = fetch,
) {
  const base = `https://graph.facebook.com/${config.apiVersion ?? "v21.0"}/${config.phoneNumberId}/messages`;

  async function post(body: Record<string, unknown>): Promise<MetaSendResult> {
    const res = await fetchImpl(base, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Meta WhatsApp send failed: ${res.status} ${err}`);
    }
    const data = (await res.json()) as {
      messages?: { id: string }[];
    };
    return { message_id: data.messages?.[0]?.id ?? "unknown" };
  }

  return {
    async sendText(toE164: string, text: string): Promise<MetaSendResult> {
      const to = toE164.replace(/^\+/, "");
      return post({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { preview_url: false, body: text },
      });
    },

    async sendTemplate(
      toE164: string,
      templateName: string,
      language = "en",
    ): Promise<MetaSendResult> {
      const to = toE164.replace(/^\+/, "");
      return post({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: language },
        },
      });
    },
  };
}

export type MetaClient = ReturnType<typeof createMetaClient>;
