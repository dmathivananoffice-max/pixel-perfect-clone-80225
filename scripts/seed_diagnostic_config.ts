/**
 * Seed growth.config with diagnostic rules + branch configs (FR-D-06).
 * Usage (with DATABASE_URL or local socket):
 *   bun scripts/seed_diagnostic_config.ts
 *
 * Prefers SUPABASE service role REST when SUPABASE_URL + SERVICE_ROLE are set.
 */
import nursingProfessionalRules from "../src/growth/diagnostic/rules/nursing-professional.v1.json";
import nursingAusbildungRules from "../src/growth/diagnostic/rules/nursing-ausbildung.v1.json";
import nursingProfessionalBranch from "../src/growth/diagnostic/branches/nursing-professional.v1.json";
import nursingAusbildungBranch from "../src/growth/diagnostic/branches/nursing-ausbildung.v1.json";

const rows = [
  {
    key: "diagnostic_rules:nursing-professional",
    value: nursingProfessionalRules,
    version: 1,
    updated_by: "seed_diagnostic_config",
  },
  {
    key: "diagnostic_rules:nursing-ausbildung",
    value: nursingAusbildungRules,
    version: 1,
    updated_by: "seed_diagnostic_config",
  },
  {
    key: "diagnostic_branches:nursing-professional",
    value: nursingProfessionalBranch,
    version: 1,
    updated_by: "seed_diagnostic_config",
  },
  {
    key: "diagnostic_branches:nursing-ausbildung",
    value: nursingAusbildungBranch,
    version: 1,
    updated_by: "seed_diagnostic_config",
  },
];

async function seedViaRest() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;

  for (const row of rows) {
    const res = await fetch(`${url}/rest/v1/config`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Content-Profile": "growth",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ ...row, active: true }),
    });
    if (!res.ok) {
      throw new Error(`seed failed for ${row.key}: ${await res.text()}`);
    }
    console.log("seeded", row.key);
  }
  return true;
}

async function seedViaLocalPsql() {
  const { spawnSync } = await import("node:child_process");
  for (const row of rows) {
    const sql = `
      INSERT INTO growth.config (key, value, version, active, updated_by)
      VALUES (
        ${literal(row.key)},
        ${literal(JSON.stringify(row.value))}::jsonb,
        ${row.version},
        true,
        ${literal(row.updated_by)}
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
      throw new Error(`psql seed failed for ${row.key}`);
    }
    console.log("seeded (local)", row.key);
  }
  return true;
}

function literal(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

const viaRest = await seedViaRest();
if (!viaRest) {
  await seedViaLocalPsql();
}
console.log("OK: diagnostic config seeded");
