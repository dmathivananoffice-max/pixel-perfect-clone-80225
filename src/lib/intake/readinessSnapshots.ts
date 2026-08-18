// ─────────────────────────────────────────────────────────────
// Sprint 0 — readiness snapshot capture + live recompute.
// Uses the same `readiness()` function as production so a snapshot
// taken before any dictionary change can prove pct has not moved.
// ─────────────────────────────────────────────────────────────
import { supabase } from "@/integrations/supabase/client";
import { computeReadinessPct } from "./readinessCompute";

export { computeReadinessPct, mergedFieldsFromExtracted } from "./readinessCompute";

export interface SnapshotInsert {
  candidate_id: string;
  readiness_pct: number;
  captured_at: string;
  schema_version: number | null;
  required_total: number;
  required_satisfied: number;
  fingerprint: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    human_value_count: number;
  };
}

export async function captureReadinessSnapshots(opts?: {
  capturedAt?: string;
}): Promise<{ inserted: number; rows: SnapshotInsert[]; error?: string }> {
  const capturedAt = opts?.capturedAt ?? new Date().toISOString();
  const { data: candidates, error: candErr } = await supabase
    .from("candidates")
    .select("candidate_id, schema_version, first_name, last_name, email, extracted_fields");
  if (candErr) return { inserted: 0, rows: [], error: candErr.message };

  const { data: humanRows } = await supabase
    .from("document_extractions")
    .select("candidate_id, section, field_name, human_value, status")
    .not("human_value", "is", null);

  const humansByCand = new Map<
    string,
    Array<{ key: string; value: string; status: "human_edited" | "verified" }>
  >();
  for (const r of humanRows ?? []) {
    const cid = (r as { candidate_id: string }).candidate_id;
    const section = String((r as { section: string | null }).section ?? "");
    const field = String((r as { field_name: string | null }).field_name ?? "");
    if (!section || !field) continue;
    const arr = humansByCand.get(cid) ?? [];
    arr.push({
      key: `${section}.${field}`,
      value: String((r as { human_value: unknown }).human_value),
      status:
        (r as { status: string | null }).status === "verified" ? "verified" : "human_edited",
    });
    humansByCand.set(cid, arr);
  }

  const rows: SnapshotInsert[] = (candidates ?? []).map((c) => {
    const humans = humansByCand.get(c.candidate_id) ?? [];
    const r = computeReadinessPct(c.extracted_fields, c.schema_version as number | null, humans);
    return {
      candidate_id: c.candidate_id,
      readiness_pct: r.pct,
      captured_at: capturedAt,
      schema_version: (c.schema_version as number | null) ?? 1,
      required_total: r.requiredTotal,
      required_satisfied: r.requiredSatisfied,
      fingerprint: {
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email,
        human_value_count: humans.length,
      },
    };
  });

  if (rows.length === 0) return { inserted: 0, rows };

  const { error: insErr } = await supabase.from("readiness_snapshots").insert(
    rows.map((r) => ({
      candidate_id: r.candidate_id,
      readiness_pct: r.readiness_pct,
      captured_at: r.captured_at,
      schema_version: r.schema_version,
      required_total: r.required_total,
      required_satisfied: r.required_satisfied,
      fingerprint: r.fingerprint,
    })),
  );
  if (insErr) return { inserted: 0, rows, error: insErr.message };
  return { inserted: rows.length, rows };
}
