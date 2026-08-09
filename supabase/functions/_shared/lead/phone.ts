/**
 * E.164 normalisation for lead capture (FR-L-02).
 * Default region: India (+91) — primary candidate market (SRD C-06).
 */

const E164_RE = /^\+[1-9]\d{7,14}$/;

export type PhoneNormalizeResult =
  | { ok: true; e164: string }
  | { ok: false; error: string };

/** Strip separators; keep leading + if present. */
export function digitsPreservingPlus(input: string): string {
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Normalise to E.164. Accepts:
 * - Already E.164 (+9198…)
 * - India local 10-digit mobiles (98… → +91…)
 * - India with leading 0 / 91 without +
 */
export function normalizePhoneE164(
  input: string,
  defaultRegion: "IN" = "IN",
): PhoneNormalizeResult {
  if (input == null || typeof input !== "string" || !input.trim()) {
    return { ok: false, error: "phone is required" };
  }

  const raw = digitsPreservingPlus(input);

  if (raw.startsWith("+")) {
    if (!E164_RE.test(raw)) {
      return { ok: false, error: "phone must be valid E.164" };
    }
    return { ok: true, e164: raw };
  }

  const digits = raw;

  if (defaultRegion === "IN") {
    if (/^0[6-9]\d{9}$/.test(digits)) {
      return { ok: true, e164: `+91${digits.slice(1)}` };
    }
    if (/^[6-9]\d{9}$/.test(digits)) {
      return { ok: true, e164: `+91${digits}` };
    }
    if (/^91[6-9]\d{9}$/.test(digits)) {
      return { ok: true, e164: `+${digits}` };
    }
  }

  // Generic: country code + national number without +
  if (/^[1-9]\d{7,14}$/.test(digits)) {
    const e164 = `+${digits}`;
    if (E164_RE.test(e164)) return { ok: true, e164 };
  }

  return { ok: false, error: "phone must be valid E.164" };
}
