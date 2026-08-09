#!/usr/bin/env bash
# Verify Growth Phase 1 schema migration on a fresh local PostgreSQL database.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATION="$ROOT/supabase/migrations/20260809090000_growth_phase1_schema.sql"
DB_NAME="${GROWTH_VERIFY_DB:-growth_phase1_verify}"
PSQL_AS_POSTGRES=(sudo -u postgres psql -v ON_ERROR_STOP=1)

if [[ ! -f "$MIGRATION" ]]; then
  echo "FAIL: migration not found at $MIGRATION" >&2
  exit 1
fi

echo "==> Recreating database ${DB_NAME}"
"${PSQL_AS_POSTGRES[@]}" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"
"${PSQL_AS_POSTGRES[@]}" -d postgres -c "CREATE DATABASE ${DB_NAME};"

echo "==> Installing auth/app stubs (stand-in for prior Supabase migrations)"
"${PSQL_AS_POSTGRES[@]}" -d "$DB_NAME" <<'SQL'
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE TABLE public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL DEFAULT '',
  role_key text NOT NULL DEFAULT 'counsellor',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
SQL

echo "==> Applying growth Phase 1 migration"
"${PSQL_AS_POSTGRES[@]}" -d "$DB_NAME" -f "$MIGRATION"

echo "==> Listing growth tables"
TABLES="$("${PSQL_AS_POSTGRES[@]}" -d "$DB_NAME" -Atc \
  "SELECT tablename FROM pg_tables WHERE schemaname='growth' ORDER BY 1;")"
EXPECTED=(
  asset audit config config_change conversation diagnostic_session
  funnel_event intake lead llm_usage message objection score
  score_override send_event sequence
)
MISSING=0
for t in "${EXPECTED[@]}"; do
  if ! grep -qx "$t" <<<"$TABLES"; then
    echo "FAIL: missing growth.$t" >&2
    MISSING=1
  fi
done
if [[ "$MISSING" -ne 0 ]]; then
  echo "Tables present:" >&2
  echo "$TABLES" >&2
  exit 1
fi
echo "$TABLES" | sed 's/^/  growth./'
echo "OK: all $(echo "$TABLES" | wc -l) expected tables present"

echo "==> Insert audit row as growth_app, then UPDATE (must fail)"
"${PSQL_AS_POSTGRES[@]}" -d "$DB_NAME" <<'SQL'
GRANT growth_app TO postgres;
SET ROLE growth_app;
INSERT INTO growth.audit (actor, action, entity, gate_results)
VALUES ('verify', 'test.insert', 'lead', '{}'::jsonb);
SQL

set +e
UPDATE_OUT="$("${PSQL_AS_POSTGRES[@]}" -d "$DB_NAME" <<'SQL' 2>&1
GRANT growth_app TO postgres;
SET ROLE growth_app;
UPDATE growth.audit SET action = 'tampered' WHERE actor = 'verify';
SQL
)"
UPDATE_RC=$?
set -e

if [[ "$UPDATE_RC" -eq 0 ]]; then
  echo "FAIL: UPDATE on growth.audit as growth_app succeeded (must fail)" >&2
  echo "$UPDATE_OUT" >&2
  exit 1
fi

if ! grep -Eqi 'permission denied|append-only|growth.audit' <<<"$UPDATE_OUT"; then
  echo "FAIL: UPDATE failed for unexpected reason:" >&2
  echo "$UPDATE_OUT" >&2
  exit 1
fi

echo "OK: UPDATE as growth_app failed as required"
echo "$UPDATE_OUT" | tail -n 3 | sed 's/^/  /'

echo "==> Privilege check: growth_app has no UPDATE on growth.audit"
PRIV="$("${PSQL_AS_POSTGRES[@]}" -d "$DB_NAME" -Atc \
  "SELECT has_table_privilege('growth_app', 'growth.audit', 'UPDATE');")"
if [[ "$PRIV" != "f" ]]; then
  echo "FAIL: growth_app unexpectedly has UPDATE privilege on growth.audit" >&2
  exit 1
fi
echo "OK: has_table_privilege(growth_app, growth.audit, UPDATE) = false"

echo ""
echo "PASS: growth Phase 1 schema verification"
echo "Note: In Supabase Studio, set Exposed schemas to include 'growth' to browse tables."
