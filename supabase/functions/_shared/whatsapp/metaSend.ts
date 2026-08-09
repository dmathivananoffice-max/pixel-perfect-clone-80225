export async function metaSendText(input: {
  token: string;
  phoneNumberId: string;
  to: string;
  text: string;
  apiVersion?: string;
}) {
  const version = input.apiVersion ?? "v21.0";
  const to = input.to.replace(/^\+/, "");
  const res = await fetch(
    `https://graph.facebook.com/${version}/${input.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { preview_url: false, body: input.text },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Meta send failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function metaSendTemplate(input: {
  token: string;
  phoneNumberId: string;
  to: string;
  templateName: string;
  language?: string;
  apiVersion?: string;
}) {
  const version = input.apiVersion ?? "v21.0";
  const to = input.to.replace(/^\+/, "");
  const res = await fetch(
    `https://graph.facebook.com/${version}/${input.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: input.templateName,
          language: { code: input.language ?? "en" },
        },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Meta template failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
