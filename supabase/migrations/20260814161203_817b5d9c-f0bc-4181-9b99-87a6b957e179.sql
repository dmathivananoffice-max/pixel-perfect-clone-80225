ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by_name text;

CREATE INDEX IF NOT EXISTS idx_candidates_deleted_at ON public.candidates (deleted_at);

CREATE OR REPLACE FUNCTION public.purge_binned_candidates()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _ids uuid[]; _n integer;
BEGIN
  SELECT array_agg(candidate_id) INTO _ids
  FROM public.candidates
  WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';

  IF _ids IS NULL THEN RETURN 0; END IF;

  DELETE FROM public.document_extractions WHERE candidate_id = ANY(_ids);
  DELETE FROM public.candidate_documents  WHERE candidate_id = ANY(_ids);
  DELETE FROM public.candidate_scores     WHERE candidate_id = ANY(_ids);
  DELETE FROM public.assessments          WHERE candidate_id = ANY(_ids);
  DELETE FROM public.interviews           WHERE candidate_id = ANY(_ids);
  DELETE FROM public.contracts            WHERE candidate_id = ANY(_ids);
  UPDATE public.email_logs SET candidate_id = NULL WHERE candidate_id = ANY(_ids);
  DELETE FROM public.candidates WHERE candidate_id = ANY(_ids);

  _n := array_length(_ids, 1);
  RETURN _n;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('purge-binned-candidates')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-binned-candidates');

SELECT cron.schedule(
  'purge-binned-candidates',
  '15 3 * * *',
  $$SELECT public.purge_binned_candidates();$$
);