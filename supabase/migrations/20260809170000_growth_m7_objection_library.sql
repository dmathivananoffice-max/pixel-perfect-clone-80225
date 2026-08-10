-- M7 Objection intelligence library (FR-O-01 … FR-O-03)

ALTER TABLE growth.objection
  ADD COLUMN IF NOT EXISTS pathway text,
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES growth.diagnostic_session (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS objection_pathway_at_idx ON growth.objection (pathway, at);
CREATE INDEX IF NOT EXISTS objection_taxonomy_at_idx ON growth.objection (taxonomy_code, at DESC);

-- FR-O-03 mapping: fear, evidence, approved assets, talk track
CREATE TABLE IF NOT EXISTS growth.objection_taxonomy_map (
  code text PRIMARY KEY,
  label text NOT NULL,
  underlying_fear text NOT NULL DEFAULT '',
  evidence_type text NOT NULL DEFAULT '',
  approved_asset_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  talk_track text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  updated_by text NOT NULL DEFAULT 'system',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Track Diagnostic exit-survey dispatches (FR-O-01)
CREATE TABLE IF NOT EXISTS growth.exit_survey_dispatch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES growth.diagnostic_session (id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES growth.lead (id) ON DELETE CASCADE,
  pathway text,
  status text NOT NULL DEFAULT 'SENT'
    CHECK (status IN ('SENT', 'ANSWERED', 'SKIPPED')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  objection_id uuid REFERENCES growth.objection (id) ON DELETE SET NULL,
  UNIQUE (session_id)
);

ALTER TABLE growth.objection_taxonomy_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth.exit_survey_dispatch ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON growth.objection_taxonomy_map
  TO growth_app, service_role, authenticated;
GRANT SELECT, INSERT, UPDATE ON growth.exit_survey_dispatch
  TO growth_app, service_role, growth_agent_whatsapp, authenticated;

CREATE POLICY otm_select ON growth.objection_taxonomy_map FOR SELECT TO authenticated
  USING (true);
CREATE POLICY otm_write_marketing ON growth.objection_taxonomy_map
  FOR ALL TO authenticated
  USING (growth.has_growth_role(ARRAY['marketing_operator', 'admin']))
  WITH CHECK (growth.has_growth_role(ARRAY['marketing_operator', 'admin']));
CREATE POLICY otm_app ON growth.objection_taxonomy_map FOR ALL TO growth_app
  USING (true) WITH CHECK (true);

CREATE POLICY esd_select ON growth.exit_survey_dispatch FOR SELECT TO authenticated
  USING (true);
CREATE POLICY esd_app ON growth.exit_survey_dispatch FOR ALL TO growth_app
  USING (true) WITH CHECK (true);
CREATE POLICY esd_wa ON growth.exit_survey_dispatch FOR ALL TO growth_agent_whatsapp
  USING (true) WITH CHECK (true);

INSERT INTO growth.objection_taxonomy_map
  (code, label, underlying_fear, evidence_type, approved_asset_refs, talk_track, updated_by)
VALUES
  ('COST', 'Cost', 'I cannot afford this / hidden fees', 'fee_breakdown', '[]',
   'Acknowledge money stress. Share fee categories only from APPROVED assets — never invent numbers.', 'm7-seed'),
  ('TRUST/FRAUD-FEAR', 'Trust / fraud fear', 'This might be a scam', 'proof_trust', '[]',
   'Validate the fear. Offer verifiable proof (registration, reviews) from APPROVED assets only.', 'm7-seed'),
  ('VISA-RISK', 'Visa risk', 'My visa will be refused', 'visa_process_faq', '[]',
   'Never guarantee outcomes. Explain process steps and who decides (authorities).', 'm7-seed'),
  ('LANGUAGE-DIFFICULTY', 'Language difficulty', 'My German is not good enough', 'language_plan', '[]',
   'Normalize starting level. Point to pathway language plan from APPROVED assets.', 'm7-seed'),
  ('PARENT-APPROVAL', 'Parent approval', 'Family will not agree', 'family_brief', '[]',
   'Offer a family-friendly brief. Invite ADVISOR call with decision-unit present.', 'm7-seed'),
  ('RECOGNITION-RISK', 'Recognition risk', 'My qualification will not be recognised', 'recognition_faq', '[]',
   'Case-by-case honesty. Use APPROVED recognition FAQ — no promises.', 'm7-seed'),
  ('TIMELINE', 'Timeline', 'It will take too long', 'timeline_ranges', '[]',
   'Share realistic ranges only. Avoid fixed start-date promises.', 'm7-seed'),
  ('COMPETITOR-COMPARISON', 'Competitor comparison', 'Another agency is cheaper/better', 'differentiation', '[]',
   'Do not trash competitors. Refocus on honesty, compliance, and counsellor support.', 'm7-seed'),
  ('SAFETY-ABROAD', 'Safety abroad', 'I will not be safe alone', 'safety_support', '[]',
   'Acknowledge concern. Share support structures from APPROVED materials.', 'm7-seed'),
  ('SELF-DOUBT', 'Self-doubt', 'I am not capable enough', 'success_stories_approved', '[]',
   'Encourage without false certainty. Offer next small step + advisor.', 'm7-seed'),
  ('UNCLASSIFIED', 'Unclassified', 'Unclear / needs clustering', 'human_review', '[]',
   'Log verbatim for weekly clustering. Do not invent a code.', 'm7-seed')
ON CONFLICT (code) DO NOTHING;

INSERT INTO growth.wa_template (name, language, body, meta_template_name, status)
VALUES (
  'diag_exit_survey',
  'en',
  'Quick question — what made you pause the Pathway Diagnostic? Reply with a number: 1 Cost 2 Trust 3 Visa 4 Language 5 Parents 6 Recognition 7 Timeline 8 Competitor 9 Safety 10 Self-doubt',
  'wfe_diag_exit_survey',
  'ACTIVE'
)
ON CONFLICT (name) DO NOTHING;

-- Weekly counts by taxonomy code and pathway
CREATE OR REPLACE FUNCTION growth.objection_trends(
  p_weeks int DEFAULT 8,
  p_pathway text DEFAULT NULL
)
RETURNS TABLE (
  week_start date,
  taxonomy_code text,
  pathway text,
  objection_count bigint
)
LANGUAGE sql
STABLE
SET search_path = growth
AS $$
  SELECT
    (date_trunc('week', o.at))::date AS week_start,
    COALESCE(o.taxonomy_code, 'UNCLASSIFIED') AS taxonomy_code,
    COALESCE(NULLIF(o.pathway, ''), 'unknown') AS pathway,
    count(*)::bigint AS objection_count
  FROM growth.objection o
  WHERE o.at >= date_trunc('week', now()) - ((GREATEST(p_weeks, 1) - 1) * interval '1 week')
    AND (p_pathway IS NULL OR o.pathway = p_pathway)
  GROUP BY 1, 2, 3
  ORDER BY 1, 2, 3;
$$;

REVOKE ALL ON FUNCTION growth.objection_trends(int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION growth.objection_trends(int, text)
  TO authenticated, service_role, growth_app;

-- Candidates for exit survey: DIAG_ABANDONED + lead with phone, not yet dispatched
CREATE OR REPLACE FUNCTION growth.exit_survey_candidates(p_limit int DEFAULT 50)
RETURNS TABLE (
  session_id uuid,
  lead_id uuid,
  pathway text,
  phone_e164 text
)
LANGUAGE sql
STABLE
SET search_path = growth
AS $$
  SELECT
    ds.id AS session_id,
    ds.lead_id,
    ds.branch AS pathway,
    l.phone_e164
  FROM growth.diagnostic_session ds
  JOIN growth.lead l ON l.id = ds.lead_id
  JOIN growth.funnel_event fe
    ON fe.session_id = ds.id AND fe.type = 'DIAG_ABANDONED'
  LEFT JOIN growth.exit_survey_dispatch d ON d.session_id = ds.id
  WHERE d.id IS NULL
    AND ds.lead_id IS NOT NULL
    AND l.phone_e164 IS NOT NULL
    AND COALESCE((l.consent->>'whatsapp')::boolean, false) = true
  ORDER BY fe.at DESC
  LIMIT GREATEST(p_limit, 1);
$$;

REVOKE ALL ON FUNCTION growth.exit_survey_candidates(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION growth.exit_survey_candidates(int)
  TO service_role, growth_app;
