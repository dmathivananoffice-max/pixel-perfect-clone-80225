-- M13 Ad Platform Control — READ side only (FR-AD-01, FR-AD-02, FR-AD-04)
-- No write scopes. No mutation clients. Phase 2 executor is out of scope.

CREATE TABLE IF NOT EXISTS growth.ad_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform IN ('meta', 'google')),
  external_id text NOT NULL,
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  daily_ceiling_eur numeric(12, 2),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'disabled')),
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, external_id)
);

CREATE TABLE IF NOT EXISTS growth.ad_entity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id uuid NOT NULL REFERENCES growth.ad_account (id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN (
    'campaign', 'adset', 'ad', 'ad_group', 'keyword'
  )),
  external_id text NOT NULL,
  name text NOT NULL,
  parent_id uuid REFERENCES growth.ad_entity (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  utm_template text,
  landing_url text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ad_account_id, level, external_id)
);

CREATE TABLE IF NOT EXISTS growth.campaign_metric (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_entity_id uuid NOT NULL REFERENCES growth.ad_entity (id) ON DELETE CASCADE,
  date date NOT NULL,
  hour smallint CHECK (hour IS NULL OR (hour >= 0 AND hour <= 23)),
  spend_eur numeric(14, 4) NOT NULL DEFAULT 0 CHECK (spend_eur >= 0),
  impressions bigint NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  clicks bigint NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  platform_conversions numeric(14, 4) NOT NULL DEFAULT 0,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ad_entity_id, date, hour)
);

CREATE INDEX IF NOT EXISTS ad_entity_account_level_idx
  ON growth.ad_entity (ad_account_id, level);
CREATE INDEX IF NOT EXISTS campaign_metric_date_idx
  ON growth.campaign_metric (date DESC);
CREATE INDEX IF NOT EXISTS campaign_metric_entity_date_idx
  ON growth.campaign_metric (ad_entity_id, date DESC);

ALTER TABLE growth.ad_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth.ad_entity ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth.campaign_metric ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  growth.ad_account, growth.ad_entity, growth.campaign_metric
TO growth_app, service_role;

GRANT SELECT ON
  growth.ad_account, growth.ad_entity, growth.campaign_metric
TO authenticated;

CREATE POLICY aa_select ON growth.ad_account FOR SELECT TO authenticated USING (true);
CREATE POLICY aa_app ON growth.ad_account FOR ALL TO growth_app USING (true) WITH CHECK (true);
CREATE POLICY ae_select ON growth.ad_entity FOR SELECT TO authenticated USING (true);
CREATE POLICY ae_app ON growth.ad_entity FOR ALL TO growth_app USING (true) WITH CHECK (true);
CREATE POLICY cm_select ON growth.campaign_metric FOR SELECT TO authenticated USING (true);
CREATE POLICY cm_app ON growth.campaign_metric FOR ALL TO growth_app USING (true) WITH CHECK (true);

-- Read-only sync agent role — SELECT + upsert into ad tables; never ad-platform write.
DO $$
BEGIN
  CREATE ROLE growth_agent_ads_read NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT USAGE ON SCHEMA growth TO growth_agent_ads_read;
GRANT SELECT, INSERT, UPDATE ON
  growth.ad_account, growth.ad_entity, growth.campaign_metric
TO growth_agent_ads_read;
GRANT SELECT, INSERT, UPDATE ON growth.dashboard_alert TO growth_agent_ads_read;
GRANT SELECT ON growth.funnel_event, growth.lead, growth.score TO growth_agent_ads_read;

INSERT INTO growth.config (key, value, version, active, updated_by)
VALUES (
  'ads_read_sync',
  '{
    "utm_required_keys": ["utm_source", "utm_medium", "utm_campaign"],
    "utm_template_meta": "utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_content={{ad.id}}",
    "utm_template_google": "utm_source=google&utm_medium=cpc&utm_campaign={{campaign.id}}&utm_content={{ad.id}}",
    "no_mql_spend_threshold_eur": 50,
    "sync_lookback_days": 7
  }'::jsonb,
  1, true, 'm13-migration'
)
ON CONFLICT (key, version) DO NOTHING;

COMMENT ON TABLE growth.ad_account IS
  'M13 READ: ad platform accounts. Mutation of live spend is Phase 2 executor-only.';
COMMENT ON TABLE growth.ad_entity IS
  'M13 READ: synced campaign/ad set/ad entities + UTM templates (FR-AD-01/04).';
COMMENT ON TABLE growth.campaign_metric IS
  'M13 READ: time-series spend/impressions/clicks/conversions (FR-AD-01).';
