/**
 * Seed growth.config with scoring weights + band thresholds.
 * Values are STARTING VALUES for tuning (see JSON note fields).
 */
import weights from "../src/growth/scoring/config/scoring-weights.v1.json";
import bands from "../src/growth/scoring/config/scoring-bands.v1.json";
import { spawnSync } from "node:child_process";

const rows = [
  {
    key: "scoring_weights",
    value: weights,
    version: 1,
    updated_by: "seed_scoring_config",
  },
  {
    key: "scoring_bands",
    value: bands,
    version: 1,
    updated_by: "seed_scoring_config",
  },
];

function lit(v: string) {
  return `'${v.replace(/'/g, "''")}'`;
}

for (const row of rows) {
  const sql = `
    INSERT INTO growth.config (key, value, version, active, updated_by)
    VALUES (
      ${lit(row.key)},
      ${lit(JSON.stringify(row.value))}::jsonb,
      ${row.version},
      true,
      ${lit(row.updated_by)}
    )
    ON CONFLICT (key, version) DO UPDATE
    SET value = EXCLUDED.value, active = true, updated_by = EXCLUDED.updated_by,
        updated_at = now();
  `;
  const r = spawnSync(
    "sudo",
    ["-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-d", "growth_phase1_verify", "-c", sql],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(1);
  }
  console.log("seeded", row.key, "— STARTING VALUES for tuning");
}
console.log("OK: scoring config seeded");
