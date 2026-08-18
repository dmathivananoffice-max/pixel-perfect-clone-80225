-- Sprint 1 — Phase 1 (deploy 3 days before the window). UNUSED.
-- Addendum B § M2.1 + M3.1.
--
-- Creates intake_education_records, intake_language_certificates,
-- intake_language_modules, the intake_field_values compatibility view, and
-- the status-rank helper. Do not wire these objects to application code in
-- this phase. Phase 2 backfill and Phase 3 triggers are separate migrations.

-- ---------------------------------------------------------------------------
-- Status rank used by the compatibility view and by M2.2 / M3.2 backfill.
-- verified > human_edited > everything else. AI statuses are weaker than
-- any human status so "strongest human status on any legacy field" wins.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.intake_human_status_rank(p_status text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(coalesce(p_status, ''))
    WHEN 'verified' THEN 100
    WHEN 'human_edited' THEN 90
    WHEN 'conflict' THEN 50
    WHEN 'needs_review' THEN 40
    WHEN 'flagged' THEN 30
    WHEN 'ai_high' THEN 20
    WHEN 'pending' THEN 10
    WHEN 'ai_medium' THEN 8
    WHEN 'ai_low' THEN 5
    ELSE 0
  END
$$;

-- ---------------------------------------------------------------------------
-- M2.1  intake_education_records
-- level defaults to 'unknown'. grade_scale defaults to 'other'.
-- Do NOT classify or infer either column later in the backfill.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.intake_education_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(candidate_id) ON DELETE CASCADE,
  ordinal integer NOT NULL DEFAULT 0 CHECK (ordinal >= 0),
  qualification text,
  institution text,
  year text,
  gpa text,
  level text NOT NULL DEFAULT 'unknown'
    CHECK (level IN ('unknown', 'secondary', 'diploma', 'bachelor', 'master', 'doctoral', 'other')),
  grade_scale text NOT NULL DEFAULT 'other'
    CHECK (grade_scale IN ('gpa_4', 'gpa_5', 'gpa_10', 'percentage', 'ects', 'other')),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, ordinal)
);
CREATE INDEX IF NOT EXISTS idx_intake_education_records_candidate
  ON public.intake_education_records (candidate_id, ordinal);
COMMENT ON TABLE public.intake_education_records IS
  'Addendum B M2.1. Phase 1 unused. ordinal 0 is the primary/legacy-sync row.';
COMMENT ON COLUMN public.intake_education_records.level IS
  'Do not classify during backfill. M2.2 writes ''unknown'' verbatim.';
COMMENT ON COLUMN public.intake_education_records.grade_scale IS
  'Do not infer during backfill. M2.2 writes ''other'' verbatim.';

DROP TRIGGER IF EXISTS trg_intake_education_records_updated ON public.intake_education_records;
CREATE TRIGGER trg_intake_education_records_updated
  BEFORE UPDATE ON public.intake_education_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.intake_education_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read intake_education_records" ON public.intake_education_records;
CREATE POLICY "Authenticated read intake_education_records"
  ON public.intake_education_records FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated write intake_education_records" ON public.intake_education_records;
CREATE POLICY "Authenticated write intake_education_records"
  ON public.intake_education_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_education_records TO authenticated;
GRANT ALL ON public.intake_education_records TO service_role;

-- ---------------------------------------------------------------------------
-- M3.1  intake_language_certificates
-- overall_result defaults to 'unknown'. Do NOT set 'passed' in the backfill.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.intake_language_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(candidate_id) ON DELETE CASCADE,
  ordinal integer NOT NULL DEFAULT 0 CHECK (ordinal >= 0),
  provider text,
  level text,
  cert_date text,
  overall_result text NOT NULL DEFAULT 'unknown'
    CHECK (overall_result IN ('unknown', 'passed', 'failed', 'partial')),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, ordinal)
);
CREATE INDEX IF NOT EXISTS idx_intake_language_certificates_candidate
  ON public.intake_language_certificates (candidate_id, ordinal);
COMMENT ON TABLE public.intake_language_certificates IS
  'Addendum B M3.1. Phase 1 unused. ordinal 0 is the primary/legacy-sync row.';
COMMENT ON COLUMN public.intake_language_certificates.overall_result IS
  'Do not set ''passed'' during backfill. M3.2 writes ''unknown'' verbatim.';

DROP TRIGGER IF EXISTS trg_intake_language_certificates_updated ON public.intake_language_certificates;
CREATE TRIGGER trg_intake_language_certificates_updated
  BEFORE UPDATE ON public.intake_language_certificates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.intake_language_certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read intake_language_certificates" ON public.intake_language_certificates;
CREATE POLICY "Authenticated read intake_language_certificates"
  ON public.intake_language_certificates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated write intake_language_certificates" ON public.intake_language_certificates;
CREATE POLICY "Authenticated write intake_language_certificates"
  ON public.intake_language_certificates FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_language_certificates TO authenticated;
GRANT ALL ON public.intake_language_certificates TO service_role;

-- ---------------------------------------------------------------------------
-- M3.1  intake_language_modules
-- Child of a certificate. language.exam_date fans out onto these rows, which
-- is why that legacy key is read-only through the M4 alias layer.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.intake_language_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id uuid NOT NULL REFERENCES public.intake_language_certificates(id) ON DELETE CASCADE,
  module_key text NOT NULL
    CHECK (module_key IN ('listening', 'reading', 'writing', 'speaking')),
  exam_date text,
  result text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (certificate_id, module_key)
);
CREATE INDEX IF NOT EXISTS idx_intake_language_modules_certificate
  ON public.intake_language_modules (certificate_id);
COMMENT ON TABLE public.intake_language_modules IS
  'Addendum B M3.1. Phase 1 unused. exam_date is the fan-out of language.exam_date.';
COMMENT ON COLUMN public.intake_language_modules.exam_date IS
  'Fan-out of legacy language.exam_date. M4 treats that key as read-only.';

DROP TRIGGER IF EXISTS trg_intake_language_modules_updated ON public.intake_language_modules;
CREATE TRIGGER trg_intake_language_modules_updated
  BEFORE UPDATE ON public.intake_language_modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.intake_language_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read intake_language_modules" ON public.intake_language_modules;
CREATE POLICY "Authenticated read intake_language_modules"
  ON public.intake_language_modules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated write intake_language_modules" ON public.intake_language_modules;
CREATE POLICY "Authenticated write intake_language_modules"
  ON public.intake_language_modules FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_language_modules TO authenticated;
GRANT ALL ON public.intake_language_modules TO service_role;

-- ---------------------------------------------------------------------------
-- Spec name `intake_field_values`. This product stores legacy field values in
-- candidates.extracted_fields JSONB plus document_extractions rows. The view
-- is the address M2.2 / M3.2 / M2.3 / M3.3 use.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.intake_field_values AS
WITH json_fields AS (
  SELECT
    c.candidate_id,
    sec.key AS section,
    fld.key AS field_name,
    NULLIF(TRIM(fld.value), '') AS json_value
  FROM public.candidates c
  CROSS JOIN LATERAL jsonb_each(COALESCE(c.extracted_fields, '{}'::jsonb)) AS sec(key, value)
  CROSS JOIN LATERAL jsonb_each_text(
    CASE WHEN jsonb_typeof(sec.value) = 'object' THEN sec.value ELSE '{}'::jsonb END
  ) AS fld(key, value)
),
extraction_ranked AS (
  SELECT
    d.candidate_id,
    d.section,
    d.field_name,
    d.ai_value,
    d.human_value,
    d.status,
    ROW_NUMBER() OVER (
      PARTITION BY d.candidate_id, d.section, d.field_name
      ORDER BY public.intake_human_status_rank(d.status) DESC, d.updated_at DESC
    ) AS rn
  FROM public.document_extractions d
  WHERE d.status IS DISTINCT FROM 'superseded'
)
SELECT
  COALESCE(j.candidate_id, e.candidate_id) AS candidate_id,
  (COALESCE(j.section, e.section) || '.' || COALESCE(j.field_name, e.field_name)) AS field_key,
  COALESCE(
    NULLIF(TRIM(e.human_value), ''),
    j.json_value,
    NULLIF(TRIM(e.ai_value), '')
  ) AS value,
  e.status,
  NULLIF(TRIM(e.human_value), '') AS human_value,
  NULLIF(TRIM(e.ai_value), '') AS ai_value
FROM json_fields j
FULL OUTER JOIN extraction_ranked e
  ON e.rn = 1
 AND e.candidate_id = j.candidate_id
 AND e.section = j.section
 AND e.field_name = j.field_name;

GRANT SELECT ON public.intake_field_values TO authenticated, service_role;

INSERT INTO public.intake_schema_meta (key, value)
VALUES ('sprint1.phase', '"1_unused"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
