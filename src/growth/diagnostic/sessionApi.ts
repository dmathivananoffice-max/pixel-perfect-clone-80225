import type { DiagnosticResult } from "./types";

export type SessionApiPayload = {
  action: "start" | "answer" | "complete" | "contact" | "abandon_check";
  session_id: string;
  branch?: string | null;
  answers?: Record<string, string>;
  question_index?: number;
  question_id?: string;
  result?: DiagnosticResult | null;
  lead_id?: string | null;
};

function functionsBase(): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) return "";
  return `${url.replace(/\/$/, "")}/functions/v1`;
}

/** Best-effort session sync — UI stays usable offline/local-only. */
export async function syncDiagnosticSession(
  payload: SessionApiPayload,
): Promise<{ ok: boolean; error?: string }> {
  const base = functionsBase();
  if (!base) return { ok: false, error: "no supabase url" };

  const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
    | string
    | undefined;

  try {
    const res = await fetch(`${base}/diagnostic-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(anon
          ? { apikey: anon, Authorization: `Bearer ${anon}` }
          : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: body || res.statusText };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network" };
  }
}

export async function captureDiagnosticLead(input: {
  phone: string;
  name: string;
  email?: string;
  city: string;
  diagnostic_session_id: string;
  utm?: Record<string, string>;
}): Promise<{ ok: true; lead_id: string } | { ok: false; error: string }> {
  const base = functionsBase();
  if (!base) return { ok: false, error: "Lead capture unavailable offline" };

  const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
    | string
    | undefined;

  try {
    const res = await fetch(`${base}/capture-lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(anon
          ? { apikey: anon, Authorization: `Bearer ${anon}` }
          : {}),
      },
      body: JSON.stringify({
        phone: input.phone,
        name: input.name,
        email: input.email,
        city: input.city,
        diagnostic_session_id: input.diagnostic_session_id,
        utm: input.utm ?? { landing_path: "/diagnostic" },
        consent: {
          whatsapp: true,
          email: Boolean(input.email),
          assessment_processing: true,
          consent_text_version: "diagnostic-contact-v1",
        },
      }),
    });
    const data = (await res.json()) as { lead_id?: string; error?: string };
    if (!res.ok || !data.lead_id) {
      return { ok: false, error: data.error ?? "capture failed" };
    }
    return { ok: true, lead_id: data.lead_id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "network",
    };
  }
}
