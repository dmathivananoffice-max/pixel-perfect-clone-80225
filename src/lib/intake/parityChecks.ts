// ─────────────────────────────────────────────────────────────
// Addendum B § M6 — eight parity checks (Sprint 0 safety net).
// Re-runnable. Each check returns pass/fail + failing rows.
// ─────────────────────────────────────────────────────────────
import { supabase } from "@/integrations/supabase/client";
import { LEGACY_REQUIRED_SET, requiredFields } from "@/intake/fieldDictionary";
import { LEGACY_KEY_MAP, resolveLegacyKey } from "@/intake/keyAliases";
import { captureReadinessSnapshots } from "./readinessSnapshots";
import { computeReadinessPct } from "./readinessCompute";
import { M6_CHECK_IDS } from "./parityContract";

export { M6_CHECK_IDS } from "./parityContract";

export interface ParityFailRow {
  id: string;
  detail: string;
}

export interface ParityCheckResult {
  id: string;
  title: string;
  pass: boolean;
  summary: string;
  failingRows: ParityFailRow[];
}

function fail(id: string, title: string, summary: string, failingRows: ParityFailRow[]): ParityCheckResult {
  return { id, title, pass: failingRows.length === 0, summary, failingRows };
}

export async function runParityChecks(): Promise<ParityCheckResult[]> {
  for (const key of Object.keys(LEGACY_KEY_MAP)) {
    resolveLegacyKey(key);
  }

  const [{ data: candidates, error: candErr }, { data: snapshots }, { data: humans }, { data: meta }] =
    await Promise.all([
      supabase
        .from("candidates")
        .select("candidate_id, schema_version, first_name, last_name, email, extracted_fields"),
      supabase
        .from("readiness_snapshots")
        .select("candidate_id, readiness_pct, captured_at, schema_version, fingerprint")
        .order("captured_at", { ascending: false }),
      supabase
        .from("document_extractions")
        .select("id, candidate_id, section, field_name, human_value, status")
        .not("human_value", "is", null),
      supabase.from("intake_schema_meta").select("key, value"),
    ]);

  const candList = candidates ?? [];
  const snapList = snapshots ?? [];
  const humanList = humans ?? [];
  const metaMap = new Map((meta ?? []).map((m) => [m.key, m.value]));

  const latestSnap = new Map<
    string,
    {
      readiness_pct: number;
      captured_at: string;
      schema_version: number | null;
      fingerprint: {
        first_name?: string | null;
        last_name?: string | null;
        email?: string | null;
        human_value_count?: number;
      };
    }
  >();
  for (const s of snapList) {
    if (!latestSnap.has(s.candidate_id)) {
      latestSnap.set(s.candidate_id, {
        readiness_pct: s.readiness_pct,
        captured_at: s.captured_at,
        schema_version: s.schema_version as number | null,
        fingerprint: (s.fingerprint ?? {}) as {
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          human_value_count?: number;
        },
      });
    }
  }

  const humansByCand = new Map<
    string,
    Array<{ key: string; value: string; status: "human_edited" | "verified" }>
  >();
  for (const r of humanList) {
    const cid = r.candidate_id as string;
    const arr = humansByCand.get(cid) ?? [];
    arr.push({
      key: `${r.section}.${r.field_name}`,
      value: String(r.human_value),
      status: r.status === "verified" ? "verified" : "human_edited",
    });
    humansByCand.set(cid, arr);
  }

  // M6.1 — every intake candidate has schema_version
  const missingVersion = candList.filter((c) => c.schema_version == null);
  const m61 = fail(
    "m6_1_schema_version_populated",
    "M6.1 Schema version populated",
    candErr
      ? `Could not load candidates: ${candErr.message}`
      : missingVersion.length === 0
        ? `${candList.length} candidates all have schema_version`
        : `${missingVersion.length} candidate(s) missing schema_version`,
    missingVersion.map((c) => ({
      id: c.candidate_id,
      detail: "schema_version is null",
    })),
  );

  // M6.2 — every candidate whose first snapshot was v1 is still v1
  const v1Fails: ParityFailRow[] = [];
  const existingCohort = [...latestSnap.entries()].filter(([, s]) => (s.schema_version ?? 1) === 1);
  for (const [cid] of existingCohort) {
    const cand = candList.find((c) => c.candidate_id === cid);
    if (cand && cand.schema_version !== 1) {
      v1Fails.push({
        id: cid,
        detail: `existing cohort expected v1, got ${cand.schema_version}`,
      });
    }
  }
  const m62 = fail(
    "m6_2_existing_cohort_v1",
    "M6.2 Existing cohort is schema_version 1",
    v1Fails.length === 0
      ? `${existingCohort.length} pre-migration candidates remain on version 1`
      : `${v1Fails.length} existing candidate(s) left version 1`,
    v1Fails,
  );

  // M6.3 — column default for new rows is 2
  const defaultMeta = metaMap.get("schema_version.default");
  const defaultIs2 = Number(defaultMeta) === 2 || defaultMeta === 2 || String(defaultMeta) === "2";
  const m63 = fail(
    "m6_3_new_row_default_v2",
    "M6.3 New-row default is 2",
    defaultIs2 ? "intake_schema_meta schema_version.default = 2" : "New-row default is not 2",
    defaultIs2
      ? []
      : [{ id: "schema_version.default", detail: `value=${JSON.stringify(defaultMeta)}` }],
  );

  // M6.4 — LEGACY_REQUIRED_SET is an exact copy of the current required list
  const liveRequired = requiredFields()
    .map((d) => d.key)
    .sort();
  const frozen = [...LEGACY_REQUIRED_SET].sort();
  const metaSet = Array.isArray(metaMap.get("legacy_required_set"))
    ? ([...(metaMap.get("legacy_required_set") as string[])].sort())
    : frozen;
  const setMismatch: ParityFailRow[] = [];
  if (liveRequired.join("|") !== frozen.join("|")) {
    setMismatch.push({
      id: "LEGACY_REQUIRED_SET vs requiredFields()",
      detail: `code freeze=[${frozen.join(", ")}] live=[${liveRequired.join(", ")}]`,
    });
  }
  if (metaSet.join("|") !== frozen.join("|")) {
    setMismatch.push({
      id: "intake_schema_meta.legacy_required_set",
      detail: `db=[${metaSet.join(", ")}] code=[${frozen.join(", ")}]`,
    });
  }
  const m64 = fail(
    "m6_4_legacy_required_set_frozen",
    "M6.4 LEGACY_REQUIRED_SET frozen",
    setMismatch.length === 0
      ? `${LEGACY_REQUIRED_SET.length} required keys match the live dictionary`
      : "Required-set freeze does not match live dictionary or DB meta",
    setMismatch,
  );

  // M6.5 — live readiness_pct equals latest snapshot (the critical freeze)
  const pctFails: ParityFailRow[] = [];
  for (const c of candList) {
    const snap = latestSnap.get(c.candidate_id);
    if (!snap) continue;
    const live = computeReadinessPct(
      c.extracted_fields,
      (c.schema_version as number | null) ?? 1,
      humansByCand.get(c.candidate_id) ?? [],
    );
    if (live.pct !== snap.readiness_pct) {
      pctFails.push({
        id: c.candidate_id,
        detail: `snapshot=${snap.readiness_pct}% live=${live.pct}%`,
      });
    }
  }
  const m65 = fail(
    "m6_5_readiness_pct_unchanged",
    "M6.5 Readiness % unchanged vs snapshot",
    pctFails.length === 0
      ? `All ${candList.filter((c) => latestSnap.has(c.candidate_id)).length} snapshotted candidates match`
      : `${pctFails.length} candidate(s) drifted`,
    pctFails,
  );

  // M6.6 — every candidate has at least one snapshot
  const coverageFails = candList
    .filter((c) => !latestSnap.has(c.candidate_id))
    .map((c) => ({ id: c.candidate_id, detail: "no readiness_snapshots row" }));
  const m66 = fail(
    "m6_6_snapshot_coverage",
    "M6.6 Snapshot coverage",
    coverageFails.length === 0
      ? `Every candidate (${candList.length}) has a snapshot`
      : `${coverageFails.length} candidate(s) have no snapshot`,
    coverageFails,
  );

  // M6.7 — human-edited values still present; count matches snapshot fingerprint
  const humanFails: ParityFailRow[] = [];
  for (const r of humanList) {
    if (r.human_value == null || String(r.human_value).trim() === "") {
      humanFails.push({
        id: String(r.id),
        detail: `${r.candidate_id} ${r.section}.${r.field_name} human_value empty`,
      });
    }
  }
  for (const [cid, snap] of latestSnap) {
    const expected = snap.fingerprint.human_value_count;
    if (typeof expected !== "number") continue;
    const actual = humansByCand.get(cid)?.length ?? 0;
    if (actual < expected) {
      humanFails.push({
        id: cid,
        detail: `human_value count ${actual} < snapshot ${expected}`,
      });
    }
  }
  const m67 = fail(
    "m6_7_human_values_intact",
    "M6.7 Human values intact",
    humanFails.length === 0
      ? `${humanList.length} human_value row(s) intact`
      : `${humanFails.length} human-value issue(s)`,
    humanFails,
  );

  // M6.8 — identity fields have not changed vs snapshot fingerprint
  const identFails: ParityFailRow[] = [];
  for (const c of candList) {
    const snap = latestSnap.get(c.candidate_id);
    if (!snap) continue;
    const fp = snap.fingerprint;
    const diffs: string[] = [];
    if (fp.first_name != null && fp.first_name !== c.first_name) diffs.push(`first_name ${fp.first_name}→${c.first_name}`);
    if (fp.last_name != null && fp.last_name !== c.last_name) diffs.push(`last_name ${fp.last_name}→${c.last_name}`);
    if (fp.email != null && fp.email !== c.email) diffs.push(`email ${fp.email}→${c.email}`);
    if (diffs.length) identFails.push({ id: c.candidate_id, detail: diffs.join("; ") });
  }
  const m68 = fail(
    "m6_8_identity_fields_stable",
    "M6.8 Identity fields stable",
    identFails.length === 0
      ? "first_name / last_name / email match snapshot fingerprints"
      : `${identFails.length} identity drift(s)`,
    identFails,
  );

  return [m61, m62, m63, m64, m65, m66, m67, m68];
}

export async function recaptureAndCheck(): Promise<{
  capture: Awaited<ReturnType<typeof captureReadinessSnapshots>>;
  checks: ParityCheckResult[];
}> {
  const capture = await captureReadinessSnapshots();
  const checks = await runParityChecks();
  return { capture, checks };
}
