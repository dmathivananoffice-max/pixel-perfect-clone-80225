export type InboundWaMessage = {
  from: string;
  text: string;
  message_id: string;
  timestamp: string;
};

/** Parse Meta WhatsApp Cloud API webhook payload. */
export function parseInboundMessages(payload: unknown): InboundWaMessage[] {
  const root = payload as {
    entry?: {
      changes?: {
        value?: {
          messages?: {
            from: string;
            id: string;
            timestamp: string;
            type?: string;
            text?: { body?: string };
          }[];
        };
      }[];
    }[];
  };
  const out: InboundWaMessage[] = [];
  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const msg of change.value?.messages ?? []) {
        if (msg.type && msg.type !== "text") continue;
        const text = msg.text?.body?.trim();
        if (!text) continue;
        out.push({
          from: msg.from.startsWith("+") ? msg.from : `+${msg.from}`,
          text,
          message_id: msg.id,
          timestamp: msg.timestamp,
        });
      }
    }
  }
  return out;
}
