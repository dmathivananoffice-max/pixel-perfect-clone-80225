/**
 * Simulate a full diagnostic session writing funnel_event rows to local DB.
 * bun scripts/simulate_diag_funnel_events.ts
 */
import { spawnSync } from "node:child_process";
import { evaluateDiagnostic } from "../src/growth/diagnostic/engine";
import { loadRulesFromJson } from "../src/growth/diagnostic/loadRules";
import nursingAusbildungRules from "../src/growth/diagnostic/rules/nursing-ausbildung.v1.json";

const sessionId = crypto.randomUUID();
const answers = {
  qualification: "class_10",
  age_band: "30_plus",
  german_level: "A0",
  financial_readiness: "not_ready",
  timeline_preference: "unsure",
  city_state: "other",
  parent_support: "no",
  science_background: "no",
};

const rules = loadRulesFromJson(nursingAusbildungRules);
const result = evaluateDiagnostic({
  branch: "nursing-ausbildung",
  answers,
  rules,
});

function sql(s: string) {
  const r = spawnSync(
    "sudo",
    ["-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-d", "growth_phase1_verify", "-c", s],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    throw new Error(r.stderr || r.stdout);
  }
  return r.stdout;
}

function lit(v: string) {
  return `'${v.replace(/'/g, "''")}'`;
}

sql(`
INSERT INTO growth.diagnostic_session (id, branch, answers, rules_version, started_at, updated_at)
VALUES (${lit(sessionId)}, 'nursing-ausbildung', '{}'::jsonb, 'pending', now(), now());
`);

const events = [
  ["DIAG_START", { branch: "nursing-ausbildung" }],
  ["DIAG_QUESTION_ANSWERED", { question_index: 0, question_id: "qualification" }],
  ["DIAG_QUESTION_ANSWERED", { question_index: 1, question_id: "age_band" }],
  ["DIAG_QUESTION_ANSWERED", { question_index: 2, question_id: "german_level" }],
  ["DIAG_COMPLETE", { band: result.band, rules_version: result.rules_version }],
  ["DIAG_CONTACT_CAPTURED", {}],
] as const;

for (const [type, meta] of events) {
  sql(`
    INSERT INTO growth.funnel_event (session_id, type, stage, meta, at)
    VALUES (${lit(sessionId)}, ${lit(type)}, 'diagnostic', ${lit(JSON.stringify(meta))}::jsonb, now());
  `);
}

sql(`
UPDATE growth.diagnostic_session
SET answers = ${lit(JSON.stringify(answers))}::jsonb,
    result = ${lit(JSON.stringify(result))}::jsonb,
    rules_version = ${lit(result.rules_version)},
    completed_at = now(),
    updated_at = now()
WHERE id = ${lit(sessionId)};
`);

const listing = sql(`
SELECT type, meta->>'question_index' AS qidx
FROM growth.funnel_event
WHERE session_id = ${lit(sessionId)}
ORDER BY at, type;
`);

console.log("session_id:", sessionId);
console.log("band:", result.band);
console.log("gaps:", result.gaps.join(" | "));
console.log("events:\n" + listing);
if (!listing.includes("DIAG_START") || !listing.includes("DIAG_COMPLETE")) {
  process.exit(1);
}
console.log("OK: funnel_event rows written for each step");
