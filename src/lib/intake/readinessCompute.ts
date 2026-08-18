// Pure readiness recompute — no I/O. Used by snapshots, parity, and tests.
import { FIELD_BY_KEY } from "@/intake/fieldDictionary";
import { mergeCandidateFields, readiness, type MergedField } from "@/intake/merge";

export function mergedFieldsFromExtracted(extracted: unknown): MergedField[] {
  const out: MergedField[] = [];
  if (!extracted || typeof extracted !== "object") return out;
  for (const [section, fields] of Object.entries(extracted as Record<string, unknown>)) {
    if (!fields || typeof fields !== "object") continue;
    for (const [fieldKey, raw] of Object.entries(fields as Record<string, unknown>)) {
      const value = raw == null ? "" : String(raw).trim();
      const key = `${section}.${fieldKey}`;
      const def = FIELD_BY_KEY[key];
      if (!def) continue;
      out.push({
        key,
        section: def.section,
        fieldKey: def.fieldKey,
        value,
        rawValue: value,
        confidence: value ? 1 : 0,
        status: value ? "ai_high" : "empty",
        flags: [],
        documentId: "",
        docType: "",
        source: "model",
        competing: [],
      });
    }
  }
  return out;
}

export function computeReadinessPct(
  extracted: unknown,
  schemaVersion: number | null | undefined,
  humanValues: Array<{ key: string; value: string; status: "human_edited" | "verified" }> = [],
): { pct: number; requiredTotal: number; requiredSatisfied: number; missingRequired: string[] } {
  const merged = mergeCandidateFields(mergedFieldsFromExtracted(extracted), humanValues);
  return readiness(merged, schemaVersion ?? 1);
}
