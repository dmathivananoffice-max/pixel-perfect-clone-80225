-- M2 — lead touch history + GDPR suppression (FR-L-02, FR-L-04)
-- Depends on: 20260809090000_growth_phase1_schema.sql

ALTER TABLE growth.lead
  ADD COLUMN IF NOT EXISTS erased_at timestamptz,
  ADD COLUMN IF NOT EXISTS diagnostic_session_id uuid
    REFERENCES growth.diagnostic_session (id) ON DELETE SET NULL;

CREATE TABLE growth.lead_touch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES growth.lead (id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now(),
  source_utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  click_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  landing_path text,
  diagnostic_session_id uuid REFERENCES growth.diagnostic_session (id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX lead_touch_lead_id_at_idx ON growth.lead_touch (lead_id, at);

CREATE TABLE growth.suppression (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'email', 'sms')),
  value_hash text NOT NULL,
  value_type text NOT NULL CHECK (value_type IN ('phone_e164', 'email')),
  lead_id uuid,
  reason text NOT NULL DEFAULT 'gdpr_erasure',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT suppression_channel_hash_unique UNIQUE (channel, value_hash)
);

CREATE INDEX suppression_lead_id_idx ON growth.suppression (lead_id);

REVOKE ALL ON growth.lead_touch FROM PUBLIC, anon;
REVOKE ALL ON growth.suppression FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON growth.lead_touch, growth.suppression
  TO growth_break_glass_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON growth.lead_touch
  TO authenticated, service_role, growth_app;
GRANT SELECT, INSERT ON growth.suppression
  TO authenticated, service_role, growth_app;
GRANT SELECT, INSERT ON growth.lead_touch, growth.suppression
  TO growth_agent_whatsapp;

ALTER TABLE growth.lead_touch ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth.suppression ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_touch_staff_select ON growth.lead_touch FOR SELECT TO authenticated
  USING (growth.is_staff_reader());
CREATE POLICY lead_touch_operator ON growth.lead_touch FOR ALL TO authenticated
  USING (growth.is_operator_or_admin())
  WITH CHECK (growth.is_operator_or_admin());
CREATE POLICY lead_touch_app ON growth.lead_touch FOR ALL TO growth_app
  USING (true) WITH CHECK (true);
CREATE POLICY lead_touch_agent_wa ON growth.lead_touch FOR INSERT TO growth_agent_whatsapp
  WITH CHECK (true);

CREATE POLICY suppression_select ON growth.suppression FOR SELECT TO authenticated
  USING (growth.has_growth_role(ARRAY['compliance_reviewer', 'admin']));
CREATE POLICY suppression_admin ON growth.suppression FOR ALL TO authenticated
  USING (growth.is_growth_admin()) WITH CHECK (growth.is_growth_admin());
CREATE POLICY suppression_app ON growth.suppression FOR ALL TO growth_app
  USING (true) WITH CHECK (true);
