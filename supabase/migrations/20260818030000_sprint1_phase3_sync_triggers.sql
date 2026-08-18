-- Sprint 1 — Phase 3 (in the window, after M2.2 / M3.2).
-- Addendum B § M2.3 + M3.3.
--
-- Ordinal-0 changes write back to the legacy intake_field_values address
-- (candidates.extracted_fields JSONB + matching document_extractions rows).
-- Higher ordinals do not touch legacy rows.

CREATE OR REPLACE FUNCTION public.intake_set_legacy_field(
  p_candidate_id uuid,
  p_field_key text,
  p_value text
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_dot integer;
  v_section text;
  v_field text;
BEGIN
  v_dot := position('.' in p_field_key);
  IF v_dot = 0 THEN
    RETURN;
  END IF;
  v_section := left(p_field_key, v_dot - 1);
  v_field := substr(p_field_key, v_dot + 1);

  UPDATE public.candidates
     SET extracted_fields = jsonb_set(
           jsonb_set(
             COALESCE(extracted_fields, '{}'::jsonb),
             ARRAY[v_section],
             COALESCE(extracted_fields #> ARRAY[v_section], '{}'::jsonb),
             true
           ),
           ARRAY[v_section, v_field],
           to_jsonb(COALESCE(p_value, '')),
           true
         )
   WHERE candidate_id = p_candidate_id;

  UPDATE public.document_extractions
     SET human_value = CASE
           WHEN status IN ('verified', 'human_edited') THEN COALESCE(p_value, human_value)
           ELSE human_value
         END,
         ai_value = CASE
           WHEN status IN ('verified', 'human_edited') THEN ai_value
           ELSE COALESCE(p_value, ai_value)
         END,
         updated_at = now()
   WHERE candidate_id = p_candidate_id
     AND section = v_section
     AND field_name = v_field
     AND status IS DISTINCT FROM 'superseded';
END;
$$;

-- ---------------------------------------------------------------------------
-- M2.3  education ordinal-0 → legacy education.* keys
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_education_record_to_legacy()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
  v_ordinal integer;
  v_qualification text;
  v_institution text;
  v_year text;
  v_gpa text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_id := OLD.candidate_id;
    v_ordinal := OLD.ordinal;
    v_qualification := NULL;
    v_institution := NULL;
    v_year := NULL;
    v_gpa := NULL;
  ELSE
    v_id := NEW.candidate_id;
    v_ordinal := NEW.ordinal;
    v_qualification := NEW.qualification;
    v_institution := NEW.institution;
    v_year := NEW.year;
    v_gpa := NEW.gpa;
  END IF;

  IF v_ordinal <> 0 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  PERFORM public.intake_set_legacy_field(v_id, 'education.qualification', v_qualification);
  PERFORM public.intake_set_legacy_field(v_id, 'education.institution', v_institution);
  PERFORM public.intake_set_legacy_field(v_id, 'education.year', v_year);
  PERFORM public.intake_set_legacy_field(v_id, 'education.gpa', v_gpa);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_education_record_to_legacy ON public.intake_education_records;
CREATE TRIGGER trg_sync_education_record_to_legacy
  AFTER INSERT OR UPDATE OR DELETE ON public.intake_education_records
  FOR EACH ROW EXECUTE FUNCTION public.sync_education_record_to_legacy();

-- ---------------------------------------------------------------------------
-- M3.3  language certificate ordinal-0 → legacy language.provider/level/cert_date
-- language.exam_date is NOT written here; it fans out from modules.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_language_certificate_to_legacy()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
  v_ordinal integer;
  v_provider text;
  v_level text;
  v_cert_date text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_id := OLD.candidate_id;
    v_ordinal := OLD.ordinal;
    v_provider := NULL;
    v_level := NULL;
    v_cert_date := NULL;
  ELSE
    v_id := NEW.candidate_id;
    v_ordinal := NEW.ordinal;
    v_provider := NEW.provider;
    v_level := NEW.level;
    v_cert_date := NEW.cert_date;
  END IF;

  IF v_ordinal <> 0 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  PERFORM public.intake_set_legacy_field(v_id, 'language.provider', v_provider);
  PERFORM public.intake_set_legacy_field(v_id, 'language.level', v_level);
  PERFORM public.intake_set_legacy_field(v_id, 'language.cert_date', v_cert_date);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_language_certificate_to_legacy ON public.intake_language_certificates;
CREATE TRIGGER trg_sync_language_certificate_to_legacy
  AFTER INSERT OR UPDATE OR DELETE ON public.intake_language_certificates
  FOR EACH ROW EXECUTE FUNCTION public.sync_language_certificate_to_legacy();

-- ---------------------------------------------------------------------------
-- M3.3  language modules → legacy language.exam_date (fan-out, ordinal-0 cert)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_language_module_to_legacy()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_cert public.intake_language_certificates%ROWTYPE;
  v_exam text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT * INTO v_cert FROM public.intake_language_certificates WHERE id = OLD.certificate_id;
    v_exam := NULL;
  ELSE
    SELECT * INTO v_cert FROM public.intake_language_certificates WHERE id = NEW.certificate_id;
    v_exam := NEW.exam_date;
  END IF;

  IF v_cert.id IS NULL OR v_cert.ordinal <> 0 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  PERFORM public.intake_set_legacy_field(v_cert.candidate_id, 'language.exam_date', v_exam);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_language_module_to_legacy ON public.intake_language_modules;
CREATE TRIGGER trg_sync_language_module_to_legacy
  AFTER INSERT OR UPDATE OR DELETE ON public.intake_language_modules
  FOR EACH ROW EXECUTE FUNCTION public.sync_language_module_to_legacy();

INSERT INTO public.intake_schema_meta (key, value)
VALUES ('sprint1.phase', '"3_triggers"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
