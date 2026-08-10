import { describe, expect, test } from "bun:test";
import { captureLead } from "../../supabase/functions/_shared/lead/capture.ts";
import { eraseLead } from "../../supabase/functions/_shared/lead/erase.ts";
import { MemoryLeadRepo } from "../../supabase/functions/_shared/lead/memory_repo.ts";
import { normalizePhoneE164 } from "../../supabase/functions/_shared/lead/phone.ts";
import type { CaptureLeadRequest } from "../../supabase/functions/_shared/lead/types.ts";

const baseConsent = {
  whatsapp: true,
  email: false,
  assessment_processing: true,
  consent_text_version: "consent-v1",
};

function captureBody(
  overrides: Partial<CaptureLeadRequest> = {},
): CaptureLeadRequest {
  return {
    phone: "+919876543210",
    name: "Asha",
    email: "asha@example.com",
    city: "Kochi",
    utm: {
      source: "meta",
      campaign: "nursing-kerala",
      landing_path: "/diagnostic/nursing",
    },
    click_ids: { fbclid: "fb.1", gclid: "g.1" },
    consent: { ...baseConsent },
    ...overrides,
  };
}

describe("normalizePhoneE164", () => {
  test("accepts E.164", () => {
    expect(normalizePhoneE164("+919876543210")).toEqual({
      ok: true,
      e164: "+919876543210",
    });
  });

  test("normalises India 10-digit", () => {
    expect(normalizePhoneE164("9876543210")).toEqual({
      ok: true,
      e164: "+919876543210",
    });
  });

  test("rejects invalid", () => {
    expect(normalizePhoneE164("123").ok).toBe(false);
    expect(normalizePhoneE164("").ok).toBe(false);
  });
});

describe("captureLead (FR-L-01…06)", () => {
  test("valid capture creates lead + LEAD_CREATED", async () => {
    const repo = new MemoryLeadRepo();
    const now = new Date("2026-08-09T10:00:00.000Z");
    const out = await captureLead(repo, captureBody(), now);

    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result.event).toBe("LEAD_CREATED");
    expect(out.result.created).toBe(true);
    expect(out.result.phone_e164).toBe("+919876543210");

    const lead = await repo.findById(out.result.lead_id);
    expect(lead?.name).toBe("Asha");
    expect(lead?.click_ids.gclid).toBe("g.1");
    expect(lead?.click_ids.fbclid).toBe("fb.1");
    expect(lead?.source_utm.landing_path).toBe("/diagnostic/nursing");
    expect(lead?.consent).toMatchObject({
      whatsapp: true,
      assessment_processing: true,
      consent_text_version: "consent-v1",
      timestamp: now.toISOString(),
    });
    expect(lead?.first_touch_at).toBe(now.toISOString());
    expect(repo.funnel[0]?.type).toBe("LEAD_CREATED");
    expect(repo.touches).toHaveLength(1);
  });

  test("duplicate phone merges without blank overwrite + LEAD_RETURNED", async () => {
    const repo = new MemoryLeadRepo();
    const first = await captureLead(
      repo,
      captureBody({ name: "Asha", email: "asha@example.com", city: "Kochi" }),
      new Date("2026-08-09T10:00:00.000Z"),
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await captureLead(
      repo,
      captureBody({
        name: "",
        email: "asha.new@example.com",
        city: "Bengaluru",
        utm: { source: "google", landing_path: "/ads/nursing" },
        click_ids: { gclid: "g.2" },
        consent: {
          whatsapp: true,
          email: true,
          assessment_processing: true,
          consent_text_version: "consent-v2",
        },
      }),
      new Date("2026-08-09T11:00:00.000Z"),
    );

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.result.event).toBe("LEAD_RETURNED");
    expect(second.result.lead_id).toBe(first.result.lead_id);

    const lead = await repo.findById(first.result.lead_id);
    // name blank must not wipe existing
    expect(lead?.name).toBe("Asha");
    // email already set — keep original (merge-not-overwrite)
    expect(lead?.email).toBe("asha@example.com");
    // city already set — keep original
    expect(lead?.city).toBe("Kochi");
    // new click id filled where empty; existing gclid kept
    expect(lead?.click_ids.gclid).toBe("g.1");
    expect(lead?.click_ids.fbclid).toBe("fb.1");
    // consent email newly granted; version updated
    expect(lead?.consent).toMatchObject({
      email: true,
      consent_text_version: "consent-v2",
    });
    expect(repo.touches).toHaveLength(2);
    expect(repo.funnel.map((f) => f.type)).toEqual([
      "LEAD_CREATED",
      "LEAD_RETURNED",
    ]);
  });

  test("invalid phone rejection", async () => {
    const repo = new MemoryLeadRepo();
    const out = await captureLead(repo, captureBody({ phone: "not-a-phone" }));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error.status).toBe(400);
    expect(out.error.error).toMatch(/E\.164|phone/i);
    expect(repo.leads.size).toBe(0);
  });
});

describe("eraseLead (FR-L-04)", () => {
  test("erasure cascade anonymises, clears messages, suppresses, audits", async () => {
    const repo = new MemoryLeadRepo();
    const created = await captureLead(repo, captureBody());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    repo.seedMessage(created.result.lead_id, "Hello advisor");

    const erased = await eraseLead(
      repo,
      { lead_id: created.result.lead_id },
      new Date("2026-08-09T12:00:00.000Z"),
    );
    expect(erased.ok).toBe(true);
    if (!erased.ok) return;
    expect(erased.result.already_erased).toBe(false);

    const lead = await repo.findById(created.result.lead_id);
    expect(lead?.phone_e164).toBe(`erased:${created.result.lead_id}`);
    expect(lead?.name).toBeNull();
    expect(lead?.email).toBeNull();
    expect(lead?.city).toBeNull();
    expect(lead?.click_ids).toEqual({});
    expect(lead?.erased_at).toBe("2026-08-09T12:00:00.000Z");
    expect(repo.messages.every((m) => m.body === "[erased]")).toBe(true);
    expect(repo.suppressions.some((s) => s.channel === "whatsapp")).toBe(true);
    expect(repo.suppressions.some((s) => s.channel === "email")).toBe(true);
    expect(repo.audits.some((a) => a.action === "LEAD_ERASED")).toBe(true);

    // original phone cannot be re-captured
    const again = await captureLead(repo, captureBody());
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.error.status).toBe(409);
  });

  test("erasure idempotency", async () => {
    const repo = new MemoryLeadRepo();
    const created = await captureLead(repo, captureBody());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const first = await eraseLead(repo, { lead_id: created.result.lead_id });
    const second = await eraseLead(repo, { lead_id: created.result.lead_id });

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.result.already_erased).toBe(false);
    expect(second.result.already_erased).toBe(true);
    expect(second.result.lead_id).toBe(first.result.lead_id);
    // still a single audit from the first erase
    expect(repo.audits.filter((a) => a.action === "LEAD_ERASED")).toHaveLength(
      1,
    );
  });
});
