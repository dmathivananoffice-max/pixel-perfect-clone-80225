-- M8 analytics + M15 dashboard shell (FR-A-01/02/07, FR-DB-01/02/05/06)

-- Daily stage rollups so dashboard queries stay fast (FR-DB-05)
CREATE TABLE IF NOT EXISTS growth.funnel_daily_rollup (
  day date NOT NULL,
  stage text NOT NULL,
  event_type text NOT NULL,
  pathway text NOT NULL DEFAULT 'unknown',
  source text NOT NULL DEFAULT 'unknown',
  event_count bigint NOT NULL DEFAULT 0 CHECK (event_count >= 0),
  cost_eur numeric(14, 4) NOT NULL DEFAULT 0 CHECK (cost_eur >= 0),
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, stage, event_type, pathway, source)
);

CREATE TABLE IF NOT EXISTS growth.diag_dropoff_rollup (
  day date NOT NULL,
  pathway text NOT NULL DEFAULT 'unknown',
  question_id text NOT NULL,
  question_index int NOT NULL DEFAULT 0,
  answered_count bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (day, pathway, question_id)
);

CREATE TABLE IF NOT EXISTS growth.llm_daily_rollup (
  day date NOT NULL,
  module text NOT NULL,
  tokens_in bigint NOT NULL DEFAULT 0,
  tokens_out bigint NOT NULL DEFAULT 0,
  cost_eur numeric(14, 4) NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, module)
);

CREATE TABLE IF NOT EXISTS growth.dashboard_alert (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity text NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warn', 'critical')),
  code text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  href text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE growth.funnel_daily_rollup ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth.diag_dropoff_rollup ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth.llm_daily_rollup ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth.dashboard_alert ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  growth.funnel_daily_rollup, growth.diag_dropoff_rollup,
  growth.llm_daily_rollup, growth.dashboard_alert
TO growth_app, service_role;

GRANT SELECT ON
  growth.funnel_daily_rollup, growth.diag_dropoff_rollup,
  growth.llm_daily_rollup, growth.dashboard_alert
TO authenticated;

CREATE POLICY fdr_select ON growth.funnel_daily_rollup FOR SELECT TO authenticated USING (true);
CREATE POLICY fdr_app ON growth.funnel_daily_rollup FOR ALL TO growth_app USING (true) WITH CHECK (true);
CREATE POLICY ddr_select ON growth.diag_dropoff_rollup FOR SELECT TO authenticated USING (true);
CREATE POLICY ddr_app ON growth.diag_dropoff_rollup FOR ALL TO growth_app USING (true) WITH CHECK (true);
CREATE POLICY ldr_select ON growth.llm_daily_rollup FOR SELECT TO authenticated USING (true);
CREATE POLICY ldr_app ON growth.llm_daily_rollup FOR ALL TO growth_app USING (true) WITH CHECK (true);
CREATE POLICY da_select ON growth.dashboard_alert FOR SELECT TO authenticated USING (true);
CREATE POLICY da_app ON growth.dashboard_alert FOR ALL TO growth_app USING (true) WITH CHECK (true);

INSERT INTO growth.config (key, value, version, active, updated_by)
VALUES (
  'analytics_envelope',
  '{"infra_monthly_eur": 300, "hot_sla_business_hours": 4}'::jsonb,
  1, true, 'm8-migration'
)
ON CONFLICT (key, version) DO NOTHING;

-- Hourly rollup helper (called by pg-boss worker / edge)
CREATE OR REPLACE FUNCTION growth.refresh_funnel_daily_rollup(p_days int DEFAULT 14)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = growth
AS $$
DECLARE
  n int;
BEGIN
  DELETE FROM growth.funnel_daily_rollup
  WHERE day >= CURRENT_DATE - (GREATEST(p_days, 1) - 1);

  INSERT INTO growth.funnel_daily_rollup (
    day, stage, event_type, pathway, source, event_count, cost_eur, computed_at
  )
  SELECT
    (fe.at AT TIME ZONE 'UTC')::date AS day,
    fe.stage,
    fe.type AS event_type,
    COALESCE(fe.meta->>'pathway', ds.branch, 'unknown') AS pathway,
    COALESCE(fe.meta->>'source', l.source_utm->>'source', 'unknown') AS source,
    count(*)::bigint,
    0::numeric,
    now()
  FROM growth.funnel_event fe
  LEFT JOIN growth.lead l ON l.id = fe.lead_id
  LEFT JOIN growth.diagnostic_session ds ON ds.id = fe.session_id
  WHERE fe.at >= (CURRENT_DATE - (GREATEST(p_days, 1) - 1))::timestamptz
  GROUP BY 1, 2, 3, 4, 5;

  GET DIAGNOSTICS n = ROW_COUNT;

  DELETE FROM growth.diag_dropoff_rollup
  WHERE day >= CURRENT_DATE - (GREATEST(p_days, 1) - 1);

  INSERT INTO growth.diag_dropoff_rollup (
    day, pathway, question_id, question_index, answered_count
  )
  SELECT
    (fe.at AT TIME ZONE 'UTC')::date,
    COALESCE(fe.meta->>'pathway', ds.branch, 'unknown'),
    COALESCE(fe.meta->>'question_id', 'unknown'),
    COALESCE((fe.meta->>'question_index')::int, 0),
    count(*)::bigint
  FROM growth.funnel_event fe
  LEFT JOIN growth.diagnostic_session ds ON ds.id = fe.session_id
  WHERE fe.type = 'DIAG_QUESTION_ANSWERED'
    AND fe.at >= (CURRENT_DATE - (GREATEST(p_days, 1) - 1))::timestamptz
  GROUP BY 1, 2, 3, 4;

  DELETE FROM growth.llm_daily_rollup
  WHERE day >= CURRENT_DATE - (GREATEST(p_days, 1) - 1);

  INSERT INTO growth.llm_daily_rollup (day, module, tokens_in, tokens_out, cost_eur, computed_at)
  SELECT
    COALESCE(u.day, CURRENT_DATE),
    u.module,
    sum(u.tokens_in)::bigint,
    sum(u.tokens_out)::bigint,
    sum(u.cost_eur)::numeric,
    now()
  FROM growth.llm_usage u
  WHERE COALESCE(u.day, CURRENT_DATE) >= CURRENT_DATE - (GREATEST(p_days, 1) - 1)
  GROUP BY 1, 2;

  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION growth.refresh_funnel_daily_rollup(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION growth.refresh_funnel_daily_rollup(int)
  TO service_role, growth_app;

INSERT INTO growth.dashboard_alert (severity, code, title, body, href, active)
VALUES
  (
    'info',
    'SPEND_PLACEHOLDER',
    'Ad spend tile pending',
    'Spend connects in the next ads sync prompt. Numbers below are owned-funnel only.',
    '/dashboard?tab=home',
    true
  )
ON CONFLICT DO NOTHING;
