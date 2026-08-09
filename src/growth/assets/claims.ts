import {
  CLAIM_KEYS,
  type ClaimChecklist,
  type ClaimKey,
  type ClaimMark,
} from "./types";

export function emptyClaimChecklist(): ClaimChecklist {
  return CLAIM_KEYS.reduce((acc, key) => {
    acc[key] = { status: "absent" };
    return acc;
  }, {} as ClaimChecklist);
}

export function validateClaimChecklist(
  raw: unknown,
): { ok: true; checklist: ClaimChecklist } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "claim_checklist is required" };
  }
  const src = raw as Record<string, ClaimMark>;
  const checklist = emptyClaimChecklist();
  for (const key of CLAIM_KEYS) {
    const mark = src[key];
    if (!mark || (mark.status !== "absent" && mark.status !== "present_justified")) {
      return {
        ok: false,
        error: `claim_checklist.${key} must be absent or present_justified`,
      };
    }
    if (mark.status === "present_justified" && !mark.note?.trim()) {
      return {
        ok: false,
        error: `claim_checklist.${key} present_justified requires a note`,
      };
    }
    checklist[key] = {
      status: mark.status,
      note: mark.note?.trim() || undefined,
    };
  }
  return { ok: true, checklist };
}

/** Diff two claim checklists for the compliance UI. */
export function diffClaimChecklist(
  prior: Partial<ClaimChecklist> | null | undefined,
  next: Partial<ClaimChecklist>,
): Array<{ key: ClaimKey; from: string; to: string }> {
  const out: Array<{ key: ClaimKey; from: string; to: string }> = [];
  for (const key of CLAIM_KEYS) {
    const a = prior?.[key]?.status ?? "(none)";
    const b = next[key]?.status ?? "(none)";
    if (a !== b) out.push({ key, from: a, to: b });
  }
  return out;
}
