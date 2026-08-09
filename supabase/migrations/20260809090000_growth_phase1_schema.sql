-- =============================================================================
-- Growth OS Phase 1 — database foundation (WFE-SRD-DGS-002 §17, §3, G-4)
-- Schema: growth
-- Tables: lead, diagnostic_session, score, score_override, conversation,
--         message, objection, asset, sequence, send_event, intake,
--         funnel_event, audit, llm_usage, config, config_change
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS growth;

-- gen_random_uuid() is built-in on PG13+; keep pgcrypto optional for older envs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions';
  ELSE
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS pgcrypto';
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- DB roles: app path, break-glass (audit mutate only), per-agent services
-- Break-glass is NOT used by the application (NFR-02 / SRD §17).
-- ---------------------------------------------------------------------------
DO $$ BEGIN CREATE ROLE growth_app NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE growth_break_glass_admin NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE growth_agent_whatsapp NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE growth_agent_scoring NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE growth_agent_objection NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE growth_agent_content NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE growth_agent_copilot NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE growth_agent_anomaly NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Supabase standard roles (no-op when already present)
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT USAGE ON SCHEMA growth TO
  authenticated, service_role, growth_app, growth_break_glass_admin,
  growth_agent_whatsapp, growth_agent_scoring, growth_agent_objection,
  growth_agent_content, growth_agent_copilot, growth_agent_anomaly;

-- Role helpers map JWT → public.app_users.role_key (SRD §3 + FR-DB-06).
-- Existing super_admin / managing_director count as growth admin.
CREATE OR REPLACE FUNCTION growth.has_growth_role(roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, growth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_users
    WHERE auth_user_id = auth.uid()
      AND active = true
      AND (
        role_key = ANY (roles)
        OR (
          role_key IN ('super_admin', 'managing_director')
          AND 'admin' = ANY (roles)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION growth.is_growth_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, growth
AS $$
  SELECT growth.has_growth_role(ARRAY['admin']);
$$;

CREATE OR REPLACE FUNCTION growth.is_operator_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, growth
AS $$
  SELECT growth.has_growth_role(ARRAY['marketing_operator', 'admin']);
$$;

CREATE OR REPLACE FUNCTION growth.is_staff_reader()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, growth
AS $$
  SELECT growth.has_growth_role(ARRAY[
    'counsellor', 'marketing_operator', 'compliance_reviewer', 'admin'
  ]);
$$;

DO $$
BEGIN
  INSERT INTO public.roles (key, name, description, is_system) VALUES
    ('counsellor', 'Counsellor', 'Sales/advisory — leads workspace (FR-DB-06)', true),
    ('marketing_operator', 'Marketing Operator', 'Campaigns, content, Pending Actions (SRD §3)', true),
    ('compliance_reviewer', 'Compliance Reviewer', 'Claim-bearing assets + audit (SRD §3)', true),
    ('admin', 'Growth Admin / MD', 'Full growth oversight + config/guardrails', true)
  ON CONFLICT (key) DO NOTHING;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Tables (SRD §17 — Phase 1 entities only; v2 ad/SEO tables deferred)
-- ---------------------------------------------------------------------------
CREATE TABLE growth.lead (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text NOT NULL,
  name text,
  email text,
  city text,
  language text NOT NULL DEFAULT 'en',
  source_utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  click_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_touch_at timestamptz NOT NULL DEFAULT now(),
  consent jsonb NOT NULL DEFAULT '{}'::jsonb,
  du_flag boolean NOT NULL DEFAULT false,
  referrer_lead_id uuid REFERENCES growth.lead (id) ON DELETE SET NULL,
  platform_candidate_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_phone_e164_unique UNIQUE (phone_e164)
);

CREATE TABLE growth.diagnostic_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES growth.lead (id) ON DELETE SET NULL,
  branch text NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  abandoned_at_question text,
  rules_version text NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE growth.score (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES growth.lead (id) ON DELETE CASCADE,
  computed_at timestamptz NOT NULL DEFAULT now(),
  fit numeric NOT NULL DEFAULT 0,
  intent numeric NOT NULL DEFAULT 0,
  capability numeric NOT NULL DEFAULT 0,
  timing numeric NOT NULL DEFAULT 0,
  engagement numeric NOT NULL DEFAULT 0,
  composite numeric NOT NULL DEFAULT 0,
  band text NOT NULL CHECK (band IN ('HOT', 'WARM', 'NURTURE', 'DISQUALIFIED')),
  weights_version text NOT NULL,
  explanation jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE growth.score_override (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES growth.lead (id) ON DELETE CASCADE,
  by_user uuid NOT NULL,
  from_band text NOT NULL,
  to_band text NOT NULL,
  reason_code text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE growth.conversation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES growth.lead (id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'whatsapp',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  handled_by text NOT NULL DEFAULT 'agent'
);

CREATE TABLE growth.message (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES growth.conversation (id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body text NOT NULL,
  template_ref text,
  agent_meta jsonb,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE growth.objection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES growth.lead (id) ON DELETE SET NULL,
  source text NOT NULL,
  verbatim text NOT NULL,
  taxonomy_code text,
  logged_by text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE growth.asset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PENDING_COMPLIANCE', 'APPROVED', 'REJECTED', 'RETIRED')),
  claim_bearing boolean NOT NULL DEFAULT false,
  body_ref text NOT NULL,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE growth.sequence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key jsonb NOT NULL,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  updated_by text NOT NULL,
  version int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE growth.send_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES growth.lead (id) ON DELETE CASCADE,
  sequence_id uuid REFERENCES growth.sequence (id) ON DELETE SET NULL,
  step text NOT NULL,
  asset_id uuid REFERENCES growth.asset (id) ON DELETE SET NULL,
  channel text NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  outcome text
);

CREATE TABLE growth.intake (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway text NOT NULL,
  batch_date date NOT NULL,
  capacity int NOT NULL CHECK (capacity >= 0),
  filled int NOT NULL DEFAULT 0 CHECK (filled >= 0),
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE growth.funnel_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES growth.lead (id) ON DELETE SET NULL,
  session_id uuid REFERENCES growth.diagnostic_session (id) ON DELETE SET NULL,
  type text NOT NULL,
  stage text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE growth.audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL,
  action text NOT NULL,
  entity text NOT NULL,
  before_hash text,
  after_hash text,
  gate_results jsonb NOT NULL DEFAULT '{}'::jsonb,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE growth.llm_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  model text NOT NULL,
  tokens_in int NOT NULL DEFAULT 0 CHECK (tokens_in >= 0),
  tokens_out int NOT NULL DEFAULT 0 CHECK (tokens_out >= 0),
  cost_eur numeric(12, 6) NOT NULL DEFAULT 0 CHECK (cost_eur >= 0),
  day date NOT NULL DEFAULT CURRENT_DATE
);

-- Versioned configuration (scoring weights, band thresholds, diagnostic
-- branches, objection taxonomy) with append-only change history.
CREATE TABLE growth.config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  value jsonb NOT NULL,
  version int NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT config_key_version_unique UNIQUE (key, version)
);

CREATE TABLE growth.config_change (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text NOT NULL,
  from_version int,
  to_version int NOT NULL,
  old_value jsonb,
  new_value jsonb NOT NULL,
  changed_by text NOT NULL,
  change_note text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION growth.trg_config_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = growth
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO growth.config_change (
      config_key, from_version, to_version, old_value, new_value, changed_by
    ) VALUES (NEW.key, NULL, NEW.version, NULL, NEW.value, NEW.updated_by);
  ELSIF TG_OP = 'UPDATE'
        AND (
          NEW.value IS DISTINCT FROM OLD.value
          OR NEW.version IS DISTINCT FROM OLD.version
        ) THEN
    INSERT INTO growth.config_change (
      config_key, from_version, to_version, old_value, new_value, changed_by
    ) VALUES (
      NEW.key, OLD.version, NEW.version, OLD.value, NEW.value, NEW.updated_by
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_config_history
  AFTER INSERT OR UPDATE ON growth.config
  FOR EACH ROW EXECUTE FUNCTION growth.trg_config_history();

-- Append-only audit: only break-glass may UPDATE/DELETE (SRD §17 / G-4)
CREATE OR REPLACE FUNCTION growth.block_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user = 'growth_break_glass_admin' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION
    'growth.audit is append-only (no UPDATE/DELETE except break-glass)';
END;
$$;

CREATE TRIGGER trg_audit_append_only
  BEFORE UPDATE OR DELETE ON growth.audit
  FOR EACH ROW EXECUTE FUNCTION growth.block_audit_mutation();

-- Required indexes
CREATE INDEX funnel_event_lead_id_idx ON growth.funnel_event (lead_id);
CREATE INDEX funnel_event_stage_at_idx ON growth.funnel_event (stage, at);
CREATE INDEX message_conversation_id_at_idx ON growth.message (conversation_id, at);
CREATE INDEX objection_taxonomy_code_at_idx ON growth.objection (taxonomy_code, at);
CREATE INDEX score_lead_id_computed_at_idx ON growth.score (lead_id, computed_at);
CREATE INDEX config_key_active_idx ON growth.config (key) WHERE active;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lead', 'diagnostic_session', 'score', 'score_override', 'conversation',
    'message', 'objection', 'asset', 'sequence', 'send_event', 'intake',
    'funnel_event', 'audit', 'llm_usage', 'config', 'config_change'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON growth.%I FROM PUBLIC, anon', t);
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON growth.%I TO growth_break_glass_admin',
      t
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  growth.lead, growth.diagnostic_session, growth.score, growth.score_override,
  growth.conversation, growth.message, growth.objection, growth.asset,
  growth.sequence, growth.send_event, growth.intake, growth.funnel_event,
  growth.llm_usage, growth.config
TO authenticated, service_role, growth_app;

GRANT SELECT, INSERT ON growth.audit TO authenticated, service_role, growth_app;
GRANT SELECT, INSERT ON growth.config_change TO authenticated, service_role, growth_app;

-- Hard ban: app paths never receive audit mutation privileges
REVOKE UPDATE, DELETE ON growth.audit
  FROM authenticated, service_role, growth_app, anon, PUBLIC;

-- Agent least-privilege
GRANT SELECT, INSERT, UPDATE ON
  growth.lead, growth.conversation, growth.message, growth.objection
TO growth_agent_whatsapp;
GRANT SELECT, INSERT ON growth.audit, growth.llm_usage, growth.funnel_event
TO growth_agent_whatsapp;

GRANT SELECT ON growth.lead, growth.diagnostic_session TO growth_agent_scoring;
GRANT SELECT, INSERT ON growth.score, growth.audit, growth.llm_usage
TO growth_agent_scoring;

GRANT SELECT, UPDATE ON growth.objection TO growth_agent_objection;
GRANT SELECT, INSERT ON growth.audit, growth.llm_usage TO growth_agent_objection;

GRANT SELECT, INSERT, UPDATE ON growth.asset TO growth_agent_content;
GRANT SELECT, INSERT ON growth.audit, growth.llm_usage TO growth_agent_content;

GRANT SELECT ON
  growth.lead, growth.score, growth.conversation, growth.message, growth.objection
TO growth_agent_copilot;
GRANT SELECT, INSERT ON growth.audit, growth.llm_usage TO growth_agent_copilot;

GRANT SELECT ON
  growth.lead, growth.funnel_event, growth.intake, growth.score, growth.llm_usage
TO growth_agent_anomaly;
GRANT SELECT, INSERT ON growth.audit TO growth_agent_anomaly;

GRANT SELECT ON growth.config TO
  growth_agent_whatsapp, growth_agent_scoring, growth_agent_objection,
  growth_agent_content, growth_agent_copilot, growth_agent_anomaly;

-- ---------------------------------------------------------------------------
-- Row Level Security (SRD §3, FR-DB-06)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lead', 'diagnostic_session', 'score', 'score_override', 'conversation',
    'message', 'objection', 'asset', 'sequence', 'send_event', 'intake',
    'funnel_event', 'audit', 'llm_usage', 'config', 'config_change'
  ]
  LOOP
    EXECUTE format('ALTER TABLE growth.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- lead
CREATE POLICY lead_select ON growth.lead FOR SELECT TO authenticated
  USING (growth.is_staff_reader());
CREATE POLICY lead_update_counsellor ON growth.lead FOR UPDATE TO authenticated
  USING (growth.has_growth_role(ARRAY['counsellor', 'admin']))
  WITH CHECK (growth.has_growth_role(ARRAY['counsellor', 'admin']));
CREATE POLICY lead_operator_all ON growth.lead FOR ALL TO authenticated
  USING (growth.is_operator_or_admin())
  WITH CHECK (growth.is_operator_or_admin());
CREATE POLICY lead_app_all ON growth.lead FOR ALL TO growth_app
  USING (true) WITH CHECK (true);
CREATE POLICY lead_agent_whatsapp ON growth.lead FOR ALL TO growth_agent_whatsapp
  USING (true) WITH CHECK (true);
CREATE POLICY lead_agent_scoring_sel ON growth.lead FOR SELECT TO growth_agent_scoring
  USING (true);

-- diagnostic_session
CREATE POLICY ds_select ON growth.diagnostic_session FOR SELECT TO authenticated
  USING (growth.is_staff_reader());
CREATE POLICY ds_operator_ins ON growth.diagnostic_session FOR INSERT TO authenticated
  WITH CHECK (growth.is_operator_or_admin());
CREATE POLICY ds_admin ON growth.diagnostic_session FOR ALL TO authenticated
  USING (growth.is_growth_admin()) WITH CHECK (growth.is_growth_admin());
CREATE POLICY ds_app ON growth.diagnostic_session FOR ALL TO growth_app
  USING (true) WITH CHECK (true);
CREATE POLICY ds_scoring_sel ON growth.diagnostic_session FOR SELECT TO growth_agent_scoring
  USING (true);

-- score
CREATE POLICY score_select ON growth.score FOR SELECT TO authenticated
  USING (growth.is_staff_reader());
CREATE POLICY score_admin ON growth.score FOR ALL TO authenticated
  USING (growth.is_growth_admin()) WITH CHECK (growth.is_growth_admin());
CREATE POLICY score_app ON growth.score FOR ALL TO growth_app
  USING (true) WITH CHECK (true);
CREATE POLICY score_agent_sel ON growth.score FOR SELECT TO growth_agent_scoring
  USING (true);
CREATE POLICY score_agent_ins ON growth.score FOR INSERT TO growth_agent_scoring
  WITH CHECK (true);

-- score_override
CREATE POLICY so_select ON growth.score_override FOR SELECT TO authenticated
  USING (growth.is_staff_reader());
CREATE POLICY so_insert ON growth.score_override FOR INSERT TO authenticated
  WITH CHECK (growth.has_growth_role(ARRAY['counsellor', 'admin']));
CREATE POLICY so_admin ON growth.score_override FOR ALL TO authenticated
  USING (growth.is_growth_admin()) WITH CHECK (growth.is_growth_admin());
CREATE POLICY so_app ON growth.score_override FOR ALL TO growth_app
  USING (true) WITH CHECK (true);

-- conversation
CREATE POLICY conv_select ON growth.conversation FOR SELECT TO authenticated
  USING (growth.is_staff_reader());
CREATE POLICY conv_counsellor_upd ON growth.conversation FOR UPDATE TO authenticated
  USING (growth.has_growth_role(ARRAY['counsellor', 'admin']))
  WITH CHECK (growth.has_growth_role(ARRAY['counsellor', 'admin']));
CREATE POLICY conv_operator ON growth.conversation FOR ALL TO authenticated
  USING (growth.is_operator_or_admin())
  WITH CHECK (growth.is_operator_or_admin());
CREATE POLICY conv_app ON growth.conversation FOR ALL TO growth_app
  USING (true) WITH CHECK (true);
CREATE POLICY conv_agent ON growth.conversation FOR ALL TO growth_agent_whatsapp
  USING (true) WITH CHECK (true);

-- message
CREATE POLICY msg_select ON growth.message FOR SELECT TO authenticated
  USING (growth.is_staff_reader());
CREATE POLICY msg_counsellor_ins ON growth.message FOR INSERT TO authenticated
  WITH CHECK (growth.has_growth_role(ARRAY['counsellor', 'admin']));
CREATE POLICY msg_operator ON growth.message FOR ALL TO authenticated
  USING (growth.is_operator_or_admin())
  WITH CHECK (growth.is_operator_or_admin());
CREATE POLICY msg_app ON growth.message FOR ALL TO growth_app
  USING (true) WITH CHECK (true);
CREATE POLICY msg_agent ON growth.message FOR ALL TO growth_agent_whatsapp
  USING (true) WITH CHECK (true);

-- objection
CREATE POLICY obj_select ON growth.objection FOR SELECT TO authenticated
  USING (growth.is_staff_reader());
CREATE POLICY obj_insert ON growth.objection FOR INSERT TO authenticated
  WITH CHECK (
    growth.has_growth_role(ARRAY['counsellor', 'marketing_operator', 'admin'])
  );
CREATE POLICY obj_admin ON growth.objection FOR ALL TO authenticated
  USING (growth.is_growth_admin()) WITH CHECK (growth.is_growth_admin());
CREATE POLICY obj_app ON growth.objection FOR ALL TO growth_app
  USING (true) WITH CHECK (true);
CREATE POLICY obj_agent_wa ON growth.objection FOR INSERT TO growth_agent_whatsapp
  WITH CHECK (true);
CREATE POLICY obj_agent_cluster ON growth.objection FOR ALL TO growth_agent_objection
  USING (true) WITH CHECK (true);

-- asset
CREATE POLICY asset_select ON growth.asset FOR SELECT TO authenticated
  USING (
    growth.has_growth_role(ARRAY[
      'counsellor', 'marketing_operator', 'compliance_reviewer', 'admin'
    ])
  );
CREATE POLICY asset_operator ON growth.asset FOR ALL TO authenticated
  USING (growth.is_operator_or_admin())
  WITH CHECK (growth.is_operator_or_admin());
CREATE POLICY asset_compliance ON growth.asset FOR UPDATE TO authenticated
  USING (growth.has_growth_role(ARRAY['compliance_reviewer', 'admin']))
  WITH CHECK (growth.has_growth_role(ARRAY['compliance_reviewer', 'admin']));
CREATE POLICY asset_app ON growth.asset FOR ALL TO growth_app
  USING (true) WITH CHECK (true);
CREATE POLICY asset_agent ON growth.asset FOR ALL TO growth_agent_content
  USING (true) WITH CHECK (true);

-- sequence / send_event / intake
CREATE POLICY seq_select ON growth.sequence FOR SELECT TO authenticated
  USING (growth.has_growth_role(ARRAY['counsellor', 'marketing_operator', 'admin']));
CREATE POLICY seq_write ON growth.sequence FOR ALL TO authenticated
  USING (growth.is_operator_or_admin())
  WITH CHECK (growth.is_operator_or_admin());
CREATE POLICY seq_app ON growth.sequence FOR ALL TO growth_app
  USING (true) WITH CHECK (true);

CREATE POLICY se_select ON growth.send_event FOR SELECT TO authenticated
  USING (growth.has_growth_role(ARRAY['counsellor', 'marketing_operator', 'admin']));
CREATE POLICY se_write ON growth.send_event FOR ALL TO authenticated
  USING (growth.is_operator_or_admin())
  WITH CHECK (growth.is_operator_or_admin());
CREATE POLICY se_app ON growth.send_event FOR ALL TO growth_app
  USING (true) WITH CHECK (true);

CREATE POLICY intake_select ON growth.intake FOR SELECT TO authenticated
  USING (growth.is_staff_reader());
CREATE POLICY intake_write ON growth.intake FOR ALL TO authenticated
  USING (growth.is_operator_or_admin())
  WITH CHECK (growth.is_operator_or_admin());
CREATE POLICY intake_app ON growth.intake FOR ALL TO growth_app
  USING (true) WITH CHECK (true);
CREATE POLICY intake_anomaly ON growth.intake FOR SELECT TO growth_agent_anomaly
  USING (true);

-- funnel_event
CREATE POLICY fe_select ON growth.funnel_event FOR SELECT TO authenticated
  USING (growth.is_staff_reader());
CREATE POLICY fe_insert ON growth.funnel_event FOR INSERT TO authenticated
  WITH CHECK (growth.is_operator_or_admin());
CREATE POLICY fe_admin ON growth.funnel_event FOR ALL TO authenticated
  USING (growth.is_growth_admin()) WITH CHECK (growth.is_growth_admin());
CREATE POLICY fe_app ON growth.funnel_event FOR ALL TO growth_app
  USING (true) WITH CHECK (true);
CREATE POLICY fe_agent_wa ON growth.funnel_event FOR INSERT TO growth_agent_whatsapp
  WITH CHECK (true);
CREATE POLICY fe_anomaly ON growth.funnel_event FOR SELECT TO growth_agent_anomaly
  USING (true);

-- audit: insert + select only in policies; no UPDATE/DELETE policy for app roles
CREATE POLICY audit_select ON growth.audit FOR SELECT TO authenticated
  USING (
    growth.has_growth_role(ARRAY[
      'compliance_reviewer', 'marketing_operator', 'admin'
    ])
  );
CREATE POLICY audit_insert ON growth.audit FOR INSERT TO authenticated
  WITH CHECK (growth.is_staff_reader());
CREATE POLICY audit_app_select ON growth.audit FOR SELECT TO growth_app
  USING (true);
CREATE POLICY audit_app_insert ON growth.audit FOR INSERT TO growth_app
  WITH CHECK (true);
CREATE POLICY audit_ins_wa ON growth.audit FOR INSERT TO growth_agent_whatsapp
  WITH CHECK (true);
CREATE POLICY audit_ins_scoring ON growth.audit FOR INSERT TO growth_agent_scoring
  WITH CHECK (true);
CREATE POLICY audit_ins_obj ON growth.audit FOR INSERT TO growth_agent_objection
  WITH CHECK (true);
CREATE POLICY audit_ins_content ON growth.audit FOR INSERT TO growth_agent_content
  WITH CHECK (true);
CREATE POLICY audit_ins_copilot ON growth.audit FOR INSERT TO growth_agent_copilot
  WITH CHECK (true);
CREATE POLICY audit_ins_anomaly ON growth.audit FOR INSERT TO growth_agent_anomaly
  WITH CHECK (true);
CREATE POLICY audit_break_glass ON growth.audit FOR ALL TO growth_break_glass_admin
  USING (true) WITH CHECK (true);

-- llm_usage
CREATE POLICY llm_select ON growth.llm_usage FOR SELECT TO authenticated
  USING (growth.has_growth_role(ARRAY['marketing_operator', 'admin']));
CREATE POLICY llm_admin ON growth.llm_usage FOR ALL TO authenticated
  USING (growth.is_growth_admin()) WITH CHECK (growth.is_growth_admin());
CREATE POLICY llm_app ON growth.llm_usage FOR ALL TO growth_app
  USING (true) WITH CHECK (true);
CREATE POLICY llm_ins_wa ON growth.llm_usage FOR INSERT TO growth_agent_whatsapp
  WITH CHECK (true);
CREATE POLICY llm_ins_scoring ON growth.llm_usage FOR INSERT TO growth_agent_scoring
  WITH CHECK (true);
CREATE POLICY llm_ins_obj ON growth.llm_usage FOR INSERT TO growth_agent_objection
  WITH CHECK (true);
CREATE POLICY llm_ins_content ON growth.llm_usage FOR INSERT TO growth_agent_content
  WITH CHECK (true);
CREATE POLICY llm_ins_copilot ON growth.llm_usage FOR INSERT TO growth_agent_copilot
  WITH CHECK (true);
CREATE POLICY llm_anomaly_sel ON growth.llm_usage FOR SELECT TO growth_agent_anomaly
  USING (true);

-- config (admin writes; staff + agents read)
CREATE POLICY cfg_select ON growth.config FOR SELECT TO authenticated
  USING (growth.is_staff_reader());
CREATE POLICY cfg_admin ON growth.config FOR ALL TO authenticated
  USING (growth.is_growth_admin()) WITH CHECK (growth.is_growth_admin());
CREATE POLICY cfg_app ON growth.config FOR ALL TO growth_app
  USING (true) WITH CHECK (true);
CREATE POLICY cfg_agents ON growth.config FOR SELECT TO
  growth_agent_whatsapp, growth_agent_scoring, growth_agent_objection,
  growth_agent_content, growth_agent_copilot, growth_agent_anomaly
  USING (true);

CREATE POLICY cfgch_select ON growth.config_change FOR SELECT TO authenticated
  USING (growth.has_growth_role(ARRAY['compliance_reviewer', 'admin']));
CREATE POLICY cfgch_admin ON growth.config_change FOR ALL TO authenticated
  USING (growth.is_growth_admin()) WITH CHECK (growth.is_growth_admin());
CREATE POLICY cfgch_app ON growth.config_change FOR SELECT TO growth_app
  USING (true);
