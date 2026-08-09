/**
 * Complete scoring for a strong Diagnostic candidate and a weak one.
 * bun scripts/verify_m3_strong_weak.ts
 */
import bandsJson from "../src/growth/scoring/config/scoring-bands.v1.json";
import weightsJson from "../src/growth/scoring/config/scoring-weights.v1.json";
import { computeScore } from "../src/growth/scoring/engine";
import { loadBands, loadWeights } from "../src/growth/scoring/loadConfig";
import { createMemoryScoringStore } from "../src/growth/scoring/memoryStore";
import { MemoryJobQueue } from "../src/growth/scoring/queue";
import { ScoringService } from "../src/growth/scoring/service";
import { SCORE_JOBS } from "../src/growth/scoring/jobs";

const weights = loadWeights(weightsJson);
const bands = loadBands(bandsJson);

const strong = {
  branch: "nursing-professional",
  answers: {
    qualification: "bsc_nursing",
    experience_years: "3_5",
    german_level: "B1",
    financial_readiness: "funded",
    timeline_preference: "within_12_months",
    city_state: "kerala",
    registration_status: "active",
  },
  signals: { diagnostic_completed: true, contact_captured: true },
};

const weak = {
  branch: "nursing-ausbildung",
  answers: {
    qualification: "class_10",
    age_band: "30_plus",
    german_level: "A0",
    financial_readiness: "not_ready",
    timeline_preference: "unsure",
    city_state: "other",
    parent_support: "no",
    science_background: "no",
  },
  signals: { diagnostic_completed: true },
};

const store = createMemoryScoringStore();
const queue = new MemoryJobQueue();
const svc = new ScoringService(weights, bands, store, queue);

const strongId = crypto.randomUUID();
const weakId = crypto.randomUUID();

const s = await svc.recompute(strongId, strong, "diagnostic_completion");
const w = await svc.recompute(weakId, weak, "diagnostic_completion");

function print(label: string, row: typeof s) {
  console.log(`\n=== ${label} ===`);
  console.log("band:", row.band, "composite:", row.composite);
  console.log("subs:", {
    fit: row.fit,
    intent: row.intent,
    capability: row.capability,
    timing: row.timing,
    engagement: row.engagement,
  });
  console.log("weights_version:", row.weights_version);
  console.log("hard_dq:", row.explanation.hard_dq_rule);
  for (const [k, v] of Object.entries(row.explanation.sub_scores)) {
    console.log(`  ${k}: ${v.value} ← ${v.rules_fired.join(", ")}`);
  }
}

print("STRONG candidate", s);
print("WEAK candidate", w);

const checks: Array<[string, boolean]> = [
  ["different bands", s.band !== w.band],
  ["strong not DQ", s.band !== "DISQUALIFIED"],
  ["weak is DQ", w.band === "DISQUALIFIED"],
  ["strong has fit rules", s.explanation.sub_scores.fit.rules_fired.length > 0],
  ["weak has hard_dq explanation", Boolean(w.explanation.hard_dq_rule)],
  [
    "DQ message job enqueued",
    queue.jobs.some((j) => j.name === SCORE_JOBS.DQ_MESSAGE),
  ],
  [
    "config marked STARTING VALUES",
    /STARTING VALUES/i.test(weights.note) && /STARTING VALUES/i.test(bands.note),
  ],
];

// Also show pure computeScore parity
const s2 = computeScore(strong, weights, bands);
const w2 = computeScore(weak, weights, bands);
checks.push(["service matches engine (strong)", s.band === s2.band]);
checks.push(["service matches engine (weak)", w.band === w2.band]);

let failed = 0;
console.log("\n=== ASSERTIONS ===");
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log("\nOK: strong vs weak Diagnostic scores differ with readable explanations");
