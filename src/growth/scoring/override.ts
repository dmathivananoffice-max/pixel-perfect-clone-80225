import {
  OVERRIDE_REASON_CODES,
  type OverrideReasonCode,
  type ScoreBand,
} from "./types";

export type OverrideRequest = {
  lead_id: string;
  by_user: string;
  from_band: ScoreBand;
  to_band: ScoreBand;
  reason_code: string;
};

export type OverrideValidation =
  | { ok: true; reason_code: OverrideReasonCode }
  | { ok: false; error: string };

const BANDS: ScoreBand[] = ["HOT", "WARM", "NURTURE", "DISQUALIFIED"];

/** Counsellor override requires a known reason code (FR-S-06). */
export function validateOverride(req: OverrideRequest): OverrideValidation {
  if (!req.lead_id?.trim()) {
    return { ok: false, error: "lead_id is required" };
  }
  if (!req.by_user?.trim()) {
    return { ok: false, error: "by_user is required" };
  }
  if (!BANDS.includes(req.from_band) || !BANDS.includes(req.to_band)) {
    return { ok: false, error: "from_band and to_band must be valid bands" };
  }
  if (req.from_band === req.to_band) {
    return { ok: false, error: "to_band must differ from from_band" };
  }
  if (!req.reason_code?.trim()) {
    return { ok: false, error: "reason_code is required" };
  }
  if (
    !OVERRIDE_REASON_CODES.includes(req.reason_code as OverrideReasonCode)
  ) {
    return {
      ok: false,
      error: `reason_code must be one of: ${OVERRIDE_REASON_CODES.join(", ")}`,
    };
  }
  return { ok: true, reason_code: req.reason_code as OverrideReasonCode };
}
