-- M3 scoring: job outbox for pg-boss triggers (FR-S-03)

CREATE TABLE growth.job_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  singleton_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX job_outbox_pending_idx
  ON growth.job_outbox (created_at)
  WHERE processed_at IS NULL;

REVOKE ALL ON growth.job_outbox FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON growth.job_outbox
  TO growth_break_glass_admin;
GRANT SELECT, INSERT, UPDATE ON growth.job_outbox
  TO authenticated, service_role, growth_app;

ALTER TABLE growth.job_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_outbox_app ON growth.job_outbox FOR ALL TO growth_app
  USING (true) WITH CHECK (true);
CREATE POLICY job_outbox_operator ON growth.job_outbox FOR SELECT TO authenticated
  USING (growth.is_operator_or_admin());
CREATE POLICY job_outbox_admin ON growth.job_outbox FOR ALL TO authenticated
  USING (growth.is_growth_admin()) WITH CHECK (growth.is_growth_admin());
