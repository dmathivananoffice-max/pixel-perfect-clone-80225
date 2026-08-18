-- Sprint 1 — Phase 2 (in the window).
-- Addendum B § M2.2 + M3.2.
--
-- VERBATIM. Do not modify this file inside the window. If a check fails,
-- roll back (supabase/sql/sprint1_window_rollback.sql). Do not patch forward.
--
-- Frozen literals:
--   education.level          = 'unknown'   -- do NOT classify during backfill
--   education.grade_scale    = 'other'     -- do NOT infer the scale
--   language.overall_result  = 'unknown'   -- do NOT set 'passed'
-- Record status = strongest human status on any legacy field of that record.
-- Candidates with no legacy data get NO record.

-- ---------------------------------------------------------------------------
-- M2.2  education backfill
-- ---------------------------------------------------------------------------
INSERT INTO public.intake_education_records (
  candidate_id,
  ordinal,
  qualification,
  institution,
  year,
  gpa,
  level,
  grade_scale,
  status
)
SELECT
  c.candidate_id,
  0,
  COALESCE(
    NULLIF(TRIM(c.extracted_fields -> 'education' ->> 'qualification'), ''),
    (
      SELECT f.value FROM public.intake_field_values f
      WHERE f.candidate_id = c.candidate_id
        AND f.field_key = 'education.qualification'
        AND NULLIF(TRIM(f.value), '') IS NOT NULL
      LIMIT 1
    )
  ),
  COALESCE(
    NULLIF(TRIM(c.extracted_fields -> 'education' ->> 'institution'), ''),
    (
      SELECT f.value FROM public.intake_field_values f
      WHERE f.candidate_id = c.candidate_id
        AND f.field_key = 'education.institution'
        AND NULLIF(TRIM(f.value), '') IS NOT NULL
      LIMIT 1
    )
  ),
  COALESCE(
    NULLIF(TRIM(c.extracted_fields -> 'education' ->> 'year'), ''),
    (
      SELECT f.value FROM public.intake_field_values f
      WHERE f.candidate_id = c.candidate_id
        AND f.field_key = 'education.year'
        AND NULLIF(TRIM(f.value), '') IS NOT NULL
      LIMIT 1
    )
  ),
  COALESCE(
    NULLIF(TRIM(c.extracted_fields -> 'education' ->> 'gpa'), ''),
    (
      SELECT f.value FROM public.intake_field_values f
      WHERE f.candidate_id = c.candidate_id
        AND f.field_key = 'education.gpa'
        AND NULLIF(TRIM(f.value), '') IS NOT NULL
      LIMIT 1
    )
  ),
  'unknown',
  'other',
  COALESCE(
    (
      SELECT f.status
      FROM public.intake_field_values f
      WHERE f.candidate_id = c.candidate_id
        AND f.field_key IN (
          'education.qualification',
          'education.institution',
          'education.year',
          'education.gpa'
        )
        AND f.status IN ('verified', 'human_edited')
      ORDER BY public.intake_human_status_rank(f.status) DESC
      LIMIT 1
    ),
    'pending'
  )
FROM public.candidates c
WHERE EXISTS (
  SELECT 1
  FROM public.intake_field_values f
  WHERE f.candidate_id = c.candidate_id
    AND f.field_key IN (
      'education.qualification',
      'education.institution',
      'education.year',
      'education.gpa'
    )
    AND NULLIF(TRIM(f.value), '') IS NOT NULL
)
ON CONFLICT (candidate_id, ordinal) DO NOTHING;

-- ---------------------------------------------------------------------------
-- M3.2  language certificate backfill
-- ---------------------------------------------------------------------------
INSERT INTO public.intake_language_certificates (
  candidate_id,
  ordinal,
  provider,
  level,
  cert_date,
  overall_result,
  status
)
SELECT
  c.candidate_id,
  0,
  COALESCE(
    NULLIF(TRIM(c.extracted_fields -> 'language' ->> 'provider'), ''),
    (
      SELECT f.value FROM public.intake_field_values f
      WHERE f.candidate_id = c.candidate_id
        AND f.field_key = 'language.provider'
        AND NULLIF(TRIM(f.value), '') IS NOT NULL
      LIMIT 1
    )
  ),
  COALESCE(
    NULLIF(TRIM(c.extracted_fields -> 'language' ->> 'level'), ''),
    (
      SELECT f.value FROM public.intake_field_values f
      WHERE f.candidate_id = c.candidate_id
        AND f.field_key = 'language.level'
        AND NULLIF(TRIM(f.value), '') IS NOT NULL
      LIMIT 1
    )
  ),
  COALESCE(
    NULLIF(TRIM(c.extracted_fields -> 'language' ->> 'cert_date'), ''),
    (
      SELECT f.value FROM public.intake_field_values f
      WHERE f.candidate_id = c.candidate_id
        AND f.field_key = 'language.cert_date'
        AND NULLIF(TRIM(f.value), '') IS NOT NULL
      LIMIT 1
    )
  ),
  'unknown',
  COALESCE(
    (
      SELECT f.status
      FROM public.intake_field_values f
      WHERE f.candidate_id = c.candidate_id
        AND f.field_key IN (
          'language.provider',
          'language.level',
          'language.exam_date',
          'language.cert_date'
        )
        AND f.status IN ('verified', 'human_edited')
      ORDER BY public.intake_human_status_rank(f.status) DESC
      LIMIT 1
    ),
    'pending'
  )
FROM public.candidates c
WHERE EXISTS (
  SELECT 1
  FROM public.intake_field_values f
  WHERE f.candidate_id = c.candidate_id
    AND f.field_key IN (
      'language.provider',
      'language.level',
      'language.exam_date',
      'language.cert_date'
    )
    AND NULLIF(TRIM(f.value), '') IS NOT NULL
)
ON CONFLICT (candidate_id, ordinal) DO NOTHING;

-- Fan-out: copy language.exam_date onto the four standard modules.
-- Candidates with no exam_date get NO module rows.
INSERT INTO public.intake_language_modules (
  certificate_id,
  module_key,
  exam_date,
  status
)
SELECT
  cert.id,
  m.module_key,
  exam.value,
  cert.status
FROM public.intake_language_certificates cert
JOIN LATERAL (
  SELECT NULLIF(TRIM(f.value), '') AS value
  FROM public.intake_field_values f
  WHERE f.candidate_id = cert.candidate_id
    AND f.field_key = 'language.exam_date'
    AND NULLIF(TRIM(f.value), '') IS NOT NULL
  LIMIT 1
) exam ON exam.value IS NOT NULL
CROSS JOIN (
  VALUES ('listening'), ('reading'), ('writing'), ('speaking')
) AS m(module_key)
WHERE cert.ordinal = 0
ON CONFLICT (certificate_id, module_key) DO NOTHING;

INSERT INTO public.intake_schema_meta (key, value)
VALUES ('sprint1.phase', '"2_backfilled"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
