import { sha256Hex } from "./hash.ts";
import { normalizePhoneE164 } from "./phone.ts";
import type { LeadRepository } from "./repo.ts";
import type { EraseLeadRequest, EraseLeadResult } from "./types.ts";

export type EraseError = { status: number; error: string };

export type EraseOutcome =
  | { ok: true; result: EraseLeadResult }
  | { ok: false; error: EraseError };

/**
 * GDPR erasure (FR-L-04): anonymise lead, clear message bodies,
 * write suppression rows, audit. Idempotent.
 */
export async function eraseLead(
  repo: LeadRepository,
  request: EraseLeadRequest,
  now: Date = new Date(),
): Promise<EraseOutcome> {
  let lead =
    (request.lead_id ? await repo.findById(request.lead_id) : null) ?? null;

  if (!lead && request.phone) {
    const phone = normalizePhoneE164(request.phone);
    if (!phone.ok) {
      return { ok: false, error: { status: 400, error: phone.error } };
    }
    lead = await repo.findByPhone(phone.e164);
  }

  if (!lead) {
    return { ok: false, error: { status: 404, error: "lead not found" } };
  }

  if (lead.erased_at) {
    return {
      ok: true,
      result: {
        lead_id: lead.id,
        erased: true,
        already_erased: true,
      },
    };
  }

  const at = now.toISOString();
  const originalPhone = lead.phone_e164;
  const originalEmail = lead.email;

  const phoneHash = await sha256Hex(originalPhone);
  await repo.upsertSuppression({
    channel: "whatsapp",
    value_hash: phoneHash,
    value_type: "phone_e164",
    lead_id: lead.id,
    reason: "gdpr_erasure",
  });
  await repo.upsertSuppression({
    channel: "sms",
    value_hash: phoneHash,
    value_type: "phone_e164",
    lead_id: lead.id,
    reason: "gdpr_erasure",
  });

  if (originalEmail) {
    const emailHash = await sha256Hex(originalEmail);
    await repo.upsertSuppression({
      channel: "email",
      value_hash: emailHash,
      value_type: "email",
      lead_id: lead.id,
      reason: "gdpr_erasure",
    });
  }

  await repo.clearMessageBodies(lead.id);

  // Free the unique phone for future re-consent as a new lead
  await repo.anonymiseLead(lead.id, {
    phone_e164: `erased:${lead.id}`,
    name: null,
    email: null,
    city: null,
    source_utm: {},
    click_ids: {},
    consent: {
      whatsapp: false,
      email: false,
      assessment_processing: false,
      consent_text_version: "erased",
      timestamp: at,
      erased: true,
    },
    platform_candidate_id: null,
    diagnostic_session_id: null,
    erased_at: at,
  });

  await repo.insertAudit({
    actor: "system:erase-lead",
    action: "LEAD_ERASED",
    entity: `lead:${lead.id}`,
    before_hash: phoneHash,
    after_hash: null,
    gate_results: {
      fr: "FR-L-04",
      message_bodies_cleared: true,
      suppressed_phone: true,
      suppressed_email: Boolean(originalEmail),
    },
  });

  return {
    ok: true,
    result: {
      lead_id: lead.id,
      erased: true,
      already_erased: false,
    },
  };
}
