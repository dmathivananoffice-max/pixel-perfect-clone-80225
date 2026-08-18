-- Sprint 1 window ROLLBACK. Addendum B § M10.
--
-- Run this if any parity check fails or readiness drift is not exactly 0.
-- Do not patch forward inside the window.
--
-- Drops Phase 3 triggers and clears Phase 2 backfill. Phase 1 unused tables
-- remain in place (they were deployed unused 3 days before the window).
-- To drop Phase 1 as well, run the block at the bottom.

DROP TRIGGER IF EXISTS trg_sync_education_record_to_legacy ON public.intake_education_records;
DROP TRIGGER IF EXISTS trg_sync_language_certificate_to_legacy ON public.intake_language_certificates;
DROP TRIGGER IF EXISTS trg_sync_language_module_to_legacy ON public.intake_language_modules;

DROP FUNCTION IF EXISTS public.sync_education_record_to_legacy();
DROP FUNCTION IF EXISTS public.sync_language_certificate_to_legacy();
DROP FUNCTION IF EXISTS public.sync_language_module_to_legacy();
DROP FUNCTION IF EXISTS public.intake_set_legacy_field(uuid, text, text);

DELETE FROM public.intake_language_modules;
DELETE FROM public.intake_language_certificates;
DELETE FROM public.intake_education_records;

INSERT INTO public.intake_schema_meta (key, value)
VALUES ('sprint1.phase', '"rolled_back"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Optional Phase 1 teardown (only if the unused tables must also go):
-- DROP VIEW IF EXISTS public.intake_field_values;
-- DROP TABLE IF EXISTS public.intake_language_modules;
-- DROP TABLE IF EXISTS public.intake_language_certificates;
-- DROP TABLE IF EXISTS public.intake_education_records;
-- DROP FUNCTION IF EXISTS public.intake_human_status_rank(text);
