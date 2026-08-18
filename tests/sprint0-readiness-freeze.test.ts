import { describe, expect, test } from "bun:test";
import {
  LEGACY_REQUIRED_SET,
  requiredFields,
  requiredFieldsForSchemaVersion,
} from "../src/intake/fieldDictionary.ts";
import { mergeCandidateFields, readiness, type MergedField } from "../src/intake/merge.ts";
import { mergedFieldsFromExtracted, computeReadinessPct } from "../src/lib/intake/readinessCompute.ts";

function field(partial: Partial<MergedField> & { key: string; value: string }): MergedField {
  const [section, fieldKey] = partial.key.split(".");
  return {
    section,
    fieldKey,
    rawValue: partial.value,
    confidence: 0.95,
    status: "ai_high",
    flags: [],
    documentId: "d1",
    docType: "passport",
    source: "model",
    competing: [],
    ...partial,
  };
}

describe("Sprint 0 safety net — readiness freeze", () => {
  test("LEGACY_REQUIRED_SET is a verbatim copy of the current required-field list", () => {
    const live = requiredFields().map((d) => d.key).sort();
    const frozen = [...LEGACY_REQUIRED_SET].sort();
    expect(frozen).toEqual(live);
  });

  test("v1 and v2 required sets are identical today (no behaviour change)", () => {
    const v1 = requiredFieldsForSchemaVersion(1).map((d) => d.key);
    const v2 = requiredFieldsForSchemaVersion(2).map((d) => d.key);
    expect(v1).toEqual(v2);
    expect(v1).toEqual([...LEGACY_REQUIRED_SET]);
  });

  test("readiness pct is unchanged when resolving via schema_version 1 vs default", () => {
    const fields = [
      field({ key: "personal.first_name", value: "Ada" }),
      field({ key: "personal.last_name", value: "Lovelace" }),
    ];
    const merged = mergeCandidateFields(fields);
    const implicit = readiness(merged);
    const v1 = readiness(merged, 1);
    const v2 = readiness(merged, 2);
    expect(v1.pct).toBe(implicit.pct);
    expect(v2.pct).toBe(implicit.pct);
    expect(v1.requiredTotal).toBe(LEGACY_REQUIRED_SET.length);
    expect(v1.requiredSatisfied).toBe(2);
  });

  test("extracted_fields recompute matches merge.readiness for the same values", () => {
    const extracted = {
      personal: { first_name: "Ada", last_name: "Lovelace" },
    };
    const fromStore = computeReadinessPct(extracted, 1);
    const fromMerge = readiness(mergedFieldsFromExtracted(extracted), 1);
    expect(fromStore.pct).toBe(fromMerge.pct);
    expect(fromStore.requiredSatisfied).toBe(fromMerge.requiredSatisfied);
  });
});
