-- M1 Diagnostic session fields + abandon helper + config seeds (FR-D-08, FR-D-06)

ALTER TABLE growth.diagnostic_session
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_question_id text,
  ADD COLUMN IF NOT EXISTS last_question_index int;

CREATE INDEX IF NOT EXISTS diagnostic_session_updated_at_idx
  ON growth.diagnostic_session (updated_at)
  WHERE completed_at IS NULL AND abandoned_at_question IS NULL;

-- Mark stale incomplete sessions as abandoned (call from pg-boss / cron).
CREATE OR REPLACE FUNCTION growth.mark_abandoned_diagnostic_sessions(
  stale_after interval DEFAULT interval '30 minutes'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = growth
AS $$
DECLARE
  n int;
BEGIN
  WITH abandoned AS (
    UPDATE growth.diagnostic_session ds
    SET
      abandoned_at_question = COALESCE(ds.last_question_id, 'unknown'),
      updated_at = now()
    WHERE ds.completed_at IS NULL
      AND ds.abandoned_at_question IS NULL
      AND ds.updated_at < now() - stale_after
    RETURNING ds.id, ds.last_question_index, ds.lead_id
  ),
  ev AS (
    INSERT INTO growth.funnel_event (lead_id, session_id, type, stage, meta, at)
    SELECT
      a.lead_id,
      a.id,
      'DIAG_ABANDONED',
      'diagnostic',
      jsonb_build_object('question_index', a.last_question_index),
      now()
    FROM abandoned a
    RETURNING 1
  )
  SELECT count(*)::int INTO n FROM abandoned;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION growth.mark_abandoned_diagnostic_sessions(interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION growth.mark_abandoned_diagnostic_sessions(interval)
  TO service_role, growth_app;
