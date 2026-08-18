-- Sprint 0 — SAFETY NET. No user-facing behaviour change.
-- Spec name `intake_candidates` is public.candidates (the intake cohort).

-- 1. schema_version: stamp existing rows as 1, then default new rows to 2.
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS schema_version integer;

UPDATE public.candidates
   SET schema_version = 1
 WHERE schema_version IS NULL;

ALTER TABLE public.candidates
  ALTER COLUMN schema_version SET DEFAULT 1,
  ALTER COLUMN schema_version SET NOT NULL;

-- Existing rows are 1. New candidates created after this migration get 2.
ALTER TABLE public.candidates
  ALTER COLUMN schema_version SET DEFAULT 2;

COMMENT ON COLUMN public.candidates.schema_version IS
  'Intake field-schema version. Pre-Sprint-0 rows = 1; new rows default to 2.';

-- Spec alias so `intake_candidates` resolves to the same cohort.
CREATE OR REPLACE VIEW public.intake_candidates AS
  SELECT * FROM public.candidates;
GRANT SELECT ON public.intake_candidates TO authenticated, service_role;

-- Per-document extraction debug payload (Part 9 drawer). Staff-only UI.
ALTER TABLE public.candidate_documents
  ADD COLUMN IF NOT EXISTS extraction_debug jsonb;

-- 3. Readiness freeze snapshots.
CREATE TABLE IF NOT EXISTS public.readiness_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(candidate_id) ON DELETE CASCADE,
  readiness_pct integer NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  schema_version integer,
  required_total integer,
  required_satisfied integer,
  fingerprint jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_readiness_snapshots_candidate
  ON public.readiness_snapshots (candidate_id, captured_at DESC);
GRANT SELECT, INSERT ON public.readiness_snapshots TO authenticated;
GRANT ALL ON public.readiness_snapshots TO service_role;
ALTER TABLE public.readiness_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read readiness_snapshots" ON public.readiness_snapshots;
CREATE POLICY "Authenticated read readiness_snapshots"
  ON public.readiness_snapshots FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated insert readiness_snapshots" ON public.readiness_snapshots;
CREATE POLICY "Authenticated insert readiness_snapshots"
  ON public.readiness_snapshots FOR INSERT TO authenticated WITH CHECK (true);

-- Session-flush notices (migration_pending broadcast backing store).
CREATE TABLE IF NOT EXISTS public.system_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_by_name text
);
CREATE INDEX IF NOT EXISTS idx_system_notices_kind_created
  ON public.system_notices (kind, created_at DESC);
GRANT SELECT, INSERT ON public.system_notices TO authenticated;
GRANT ALL ON public.system_notices TO service_role;
ALTER TABLE public.system_notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read system_notices" ON public.system_notices;
CREATE POLICY "Authenticated read system_notices"
  ON public.system_notices FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated insert system_notices" ON public.system_notices;
CREATE POLICY "Authenticated insert system_notices"
  ON public.system_notices FOR INSERT TO authenticated WITH CHECK (true);

ALTER TABLE public.system_notices REPLICA IDENTITY FULL;

-- Frozen copy of the CURRENT required-field list (LEGACY_REQUIRED_SET).
CREATE TABLE IF NOT EXISTS public.intake_schema_meta (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.intake_schema_meta TO authenticated;
GRANT ALL ON public.intake_schema_meta TO service_role;
ALTER TABLE public.intake_schema_meta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read intake_schema_meta" ON public.intake_schema_meta;
CREATE POLICY "Authenticated read intake_schema_meta"
  ON public.intake_schema_meta FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated write intake_schema_meta" ON public.intake_schema_meta;
CREATE POLICY "Authenticated write intake_schema_meta"
  ON public.intake_schema_meta FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.intake_schema_meta (key, value)
VALUES
  ('schema_version.default', '2'::jsonb),
  ('legacy_required_set', '[
    "personal.first_name",
    "personal.last_name",
    "personal.dob",
    "personal.nationality",
    "passport.passport_no",
    "passport.expiry_date",
    "contact.email",
    "contact.phone",
    "education.qualification",
    "language.level"
  ]'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
