-- M9 Capacity governor (FR-G-01…03, FR-N-05 scarcity)

ALTER TABLE growth.intake
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'WAITLIST', 'CLOSED')),
  ADD COLUMN IF NOT EXISTS updated_by text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Ensure filled cannot exceed capacity at write time
ALTER TABLE growth.intake DROP CONSTRAINT IF EXISTS intake_filled_lte_capacity;
ALTER TABLE growth.intake
  ADD CONSTRAINT intake_filled_lte_capacity CHECK (filled <= capacity);

CREATE INDEX IF NOT EXISTS intake_pathway_batch_idx
  ON growth.intake (pathway, batch_date);

-- Per-pathway governor output (dashboard flag + waitlist + throttle)
CREATE TABLE IF NOT EXISTS growth.pathway_capacity_state (
  pathway text PRIMARY KEY,
  nearest_intake_id uuid REFERENCES growth.intake (id) ON DELETE SET NULL,
  next_intake_id uuid REFERENCES growth.intake (id) ON DELETE SET NULL,
  fill_ratio numeric(6, 4) NOT NULL DEFAULT 0
    CHECK (fill_ratio >= 0 AND fill_ratio <= 1),
  threshold numeric(6, 4) NOT NULL DEFAULT 0.85,
  pathway_throttled boolean NOT NULL DEFAULT false,
  waitlist_mode boolean NOT NULL DEFAULT false,
  dashboard_flagged boolean NOT NULL DEFAULT false,
  waitlist_copy text,
  nearest_batch_date date,
  next_batch_date date,
  computed_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Urgency / scarcity templates MUST reference a real intake or calendar event (FR-N-05)
CREATE TABLE IF NOT EXISTS growth.urgency_copy_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  body text NOT NULL,
  intake_id uuid REFERENCES growth.intake (id) ON DELETE RESTRICT,
  calendar_event_id text,
  active boolean NOT NULL DEFAULT true,
  updated_by text NOT NULL DEFAULT 'system',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT urgency_copy_requires_calendar_ref CHECK (
    intake_id IS NOT NULL OR (calendar_event_id IS NOT NULL AND length(trim(calendar_event_id)) > 0)
  )
);

ALTER TABLE growth.pathway_capacity_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth.urgency_copy_template ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON growth.pathway_capacity_state
  TO growth_app, service_role;
GRANT SELECT ON growth.pathway_capacity_state TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON growth.urgency_copy_template
  TO growth_app, service_role, authenticated;

CREATE POLICY pcs_select ON growth.pathway_capacity_state FOR SELECT TO authenticated
  USING (true);
CREATE POLICY pcs_app ON growth.pathway_capacity_state FOR ALL TO growth_app
  USING (true) WITH CHECK (true);

CREATE POLICY uct_select ON growth.urgency_copy_template FOR SELECT TO authenticated
  USING (true);
CREATE POLICY uct_write ON growth.urgency_copy_template FOR ALL TO authenticated
  USING (growth.has_growth_role(ARRAY['marketing_operator', 'admin']))
  WITH CHECK (growth.has_growth_role(ARRAY['marketing_operator', 'admin']));
CREATE POLICY uct_app ON growth.urgency_copy_template FOR ALL TO growth_app
  USING (true) WITH CHECK (true);

INSERT INTO growth.config (key, value, version, active, updated_by)
VALUES (
  'capacity_governor',
  '{"fill_threshold": 0.85, "schedule": "0 * * * *", "pathways": ["nursing-professional", "nursing-ausbildung"]}'::jsonb,
  1, true, 'm9-migration'
)
ON CONFLICT (key, version) DO NOTHING;

-- Nearest future (or today) OPEN intake per pathway
CREATE OR REPLACE FUNCTION growth.nearest_intake(p_pathway text)
RETURNS growth.intake
LANGUAGE sql
STABLE
SET search_path = growth
AS $$
  SELECT i.*
  FROM growth.intake i
  WHERE i.pathway = p_pathway
    AND i.status IN ('OPEN', 'WAITLIST')
    AND i.batch_date >= CURRENT_DATE
  ORDER BY i.batch_date ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION growth.next_intake_after(p_pathway text, p_after date)
RETURNS growth.intake
LANGUAGE sql
STABLE
SET search_path = growth
AS $$
  SELECT i.*
  FROM growth.intake i
  WHERE i.pathway = p_pathway
    AND i.status IN ('OPEN', 'WAITLIST')
    AND i.batch_date > p_after
  ORDER BY i.batch_date ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION growth.nearest_intake(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION growth.next_intake_after(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION growth.nearest_intake(text)
  TO authenticated, service_role, growth_app;
GRANT EXECUTE ON FUNCTION growth.next_intake_after(text, date)
  TO authenticated, service_role, growth_app;

-- Seed demo intakes (manual admin can edit; platform sync later)
INSERT INTO growth.intake (pathway, batch_date, capacity, filled, label, status, updated_by)
SELECT * FROM (VALUES
  ('nursing-professional', (date_trunc('month', CURRENT_DATE) + interval '1 month')::date, 20, 10,
   'Nursing professional — next month', 'OPEN', 'm9-seed'),
  ('nursing-professional', (date_trunc('month', CURRENT_DATE) + interval '2 month')::date, 20, 2,
   'Nursing professional — month+2', 'OPEN', 'm9-seed'),
  ('nursing-ausbildung', (date_trunc('month', CURRENT_DATE) + interval '1 month')::date, 15, 5,
   'Ausbildung — next month', 'OPEN', 'm9-seed'),
  ('nursing-ausbildung', (date_trunc('month', CURRENT_DATE) + interval '2 month')::date, 15, 1,
   'Ausbildung — month+2', 'OPEN', 'm9-seed')
) AS v(pathway, batch_date, capacity, filled, label, status, updated_by)
WHERE NOT EXISTS (
  SELECT 1 FROM growth.intake i WHERE i.pathway = v.pathway AND i.batch_date = v.batch_date
);
