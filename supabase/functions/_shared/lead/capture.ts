import { validateConsent } from "./consent.ts";
import { sha256Hex } from "./hash.ts";
import { buildMergedLeadFields } from "./merge.ts";
import { normalizePhoneE164 } from "./phone.ts";
import type { LeadRepository } from "./repo.ts";
import type { CaptureLeadRequest, CaptureLeadResult } from "./types.ts";

export type CaptureError = { status: number; error: string };

export type CaptureOutcome =
  | { ok: true; result: CaptureLeadResult }
  | { ok: false; error: CaptureError };

export async function captureLead(
  repo: LeadRepository,
  request: CaptureLeadRequest,
  now: Date = new Date(),
): Promise<CaptureOutcome> {
  const phone = normalizePhoneE164(request.phone);
  if (!phone.ok) {
    return { ok: false, error: { status: 400, error: phone.error } };
  }

  const consent = validateConsent(request.consent, now);
  if (!consent.ok) {
    return { ok: false, error: { status: 400, error: consent.error } };
  }

  const phoneHash = await sha256Hex(phone.e164);
  if (await repo.isSuppressed("phone_e164", phoneHash)) {
    return {
      ok: false,
      error: { status: 409, error: "phone is suppressed after erasure" },
    };
  }

  const at = now.toISOString();
  const utm = request.utm ?? {};
  const clickIds = request.click_ids ?? {};
  const landingPath = utm.landing_path ?? null;
  const existing = await repo.findByPhone(phone.e164);

  if (!existing) {
    const lead = await repo.insertLead({
      phone_e164: phone.e164,
      name: request.name?.trim() || null,
      email: request.email?.trim() || null,
      city: request.city?.trim() || null,
      language: request.language?.trim() || "en",
      source_utm: utm,
      click_ids: clickIds,
      first_touch_at: at,
      consent: consent.consent,
      diagnostic_session_id: request.diagnostic_session_id ?? null,
      platform_candidate_id: request.platform_candidate_id ?? null,
    });

    await repo.insertTouch({
      lead_id: lead.id,
      at,
      source_utm: utm,
      click_ids: clickIds,
      landing_path: landingPath,
      diagnostic_session_id: request.diagnostic_session_id ?? null,
      payload: { phone: phone.e164, consent: consent.consent, utm, clickIds },
    });

    await repo.insertFunnelEvent({
      lead_id: lead.id,
      session_id: request.diagnostic_session_id ?? null,
      type: "LEAD_CREATED",
      stage: "lead",
      meta: { phone_e164: phone.e164 },
      at,
    });

    return {
      ok: true,
      result: {
        lead_id: lead.id,
        phone_e164: phone.e164,
        event: "LEAD_CREATED",
        created: true,
      },
    };
  }

  if (existing.erased_at) {
    return {
      ok: false,
      error: { status: 409, error: "phone is suppressed after erasure" },
    };
  }

  const merged = buildMergedLeadFields(existing, {
    name: request.name,
    email: request.email,
    city: request.city,
    language: request.language,
    utm,
    click_ids: clickIds,
    diagnostic_session_id: request.diagnostic_session_id,
    platform_candidate_id: request.platform_candidate_id,
  });

  const prev = existing.consent as Record<string, unknown>;
  merged.consent = {
    whatsapp: Boolean(prev.whatsapp) || consent.consent.whatsapp,
    email: Boolean(prev.email) || consent.consent.email,
    assessment_processing:
      Boolean(prev.assessment_processing) ||
      consent.consent.assessment_processing,
    consent_text_version: consent.consent.consent_text_version,
    timestamp: consent.consent.timestamp,
  };

  const updated = await repo.updateLead(existing.id, merged);

  await repo.insertTouch({
    lead_id: existing.id,
    at,
    source_utm: utm,
    click_ids: clickIds,
    landing_path: landingPath,
    diagnostic_session_id: request.diagnostic_session_id ?? null,
    payload: { phone: phone.e164, consent: consent.consent, utm, clickIds },
  });

  await repo.insertFunnelEvent({
    lead_id: existing.id,
    session_id: request.diagnostic_session_id ?? null,
    type: "LEAD_RETURNED",
    stage: "lead",
    meta: { phone_e164: phone.e164 },
    at,
  });

  return {
    ok: true,
    result: {
      lead_id: updated.id,
      phone_e164: phone.e164,
      event: "LEAD_RETURNED",
      created: false,
    },
  };
}
