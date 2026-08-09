import type { DiagnosticRulesConfig, EligibilityBand } from "./types";

const BANDS: EligibilityBand[] = ["READY", "PREPARABLE", "NOT_YET"];

function assertBand(value: unknown, path: string): EligibilityBand {
  if (typeof value !== "string" || !BANDS.includes(value as EligibilityBand)) {
    throw new Error(`Invalid band at ${path}: ${String(value)}`);
  }
  return value as EligibilityBand;
}

/**
 * Validate and normalise rules JSON (from growth.config or bundled file).
 * Throws on invalid config — never silently repairs into non-determinism.
 */
export function loadRulesFromJson(raw: unknown): DiagnosticRulesConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error("rules config must be an object");
  }
  const r = raw as Record<string, unknown>;

  if (typeof r.version !== "string" || !r.version.trim()) {
    throw new Error("rules.version is required");
  }
  if (typeof r.branch !== "string" || !r.branch.trim()) {
    throw new Error("rules.branch is required");
  }
  if (typeof r.pathway !== "string" || !r.pathway.trim()) {
    throw new Error("rules.pathway is required");
  }
  if (!Array.isArray(r.rules)) {
    throw new Error("rules.rules must be an array");
  }

  const band_priority = (r.band_priority as EligibilityBand[]) ?? [
    "NOT_YET",
    "PREPARABLE",
    "READY",
  ];
  for (const b of band_priority) assertBand(b, "band_priority");

  const rules = [...r.rules]
    .map((item, idx) => {
      const rule = item as Record<string, unknown>;
      if (typeof rule.id !== "string" || !rule.id) {
        throw new Error(`rules[${idx}].id is required`);
      }
      const when = rule.when as Record<string, unknown>;
      if (!when || typeof when.answer_key !== "string") {
        throw new Error(`rules[${idx}].when.answer_key is required`);
      }
      return {
        id: rule.id,
        when: {
          answer_key: when.answer_key,
          equals: typeof when.equals === "string" ? when.equals : undefined,
          in: Array.isArray(when.in) ? (when.in as string[]) : undefined,
          not_in: Array.isArray(when.not_in)
            ? (when.not_in as string[])
            : undefined,
        },
        effects: (rule.effects ?? {}) as DiagnosticRulesConfig["rules"][0]["effects"],
      };
    })
    // Stable application order by id (determinism)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return {
    version: r.version.trim(),
    branch: r.branch.trim(),
    pathway: r.pathway.trim(),
    rules,
    band_priority,
    timeline_by_band: r.timeline_by_band as DiagnosticRulesConfig["timeline_by_band"],
    next_step_by_band:
      r.next_step_by_band as DiagnosticRulesConfig["next_step_by_band"],
    preparation_path_by_band:
      r.preparation_path_by_band as DiagnosticRulesConfig["preparation_path_by_band"],
    nurture_track_by_band:
      r.nurture_track_by_band as DiagnosticRulesConfig["nurture_track_by_band"],
  };
}

/** Map a growth.config row value into rules (config key: diagnostic_rules:<branch>). */
export function rulesFromConfigValue(value: unknown): DiagnosticRulesConfig {
  return loadRulesFromJson(value);
}
