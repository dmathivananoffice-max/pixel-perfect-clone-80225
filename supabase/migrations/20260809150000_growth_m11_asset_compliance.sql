-- M11 compliance gate + asset library (G-2 / FR-P-*)
-- Lifecycle: DRAFT → IN_REVIEW → APPROVED → RETIRED (+ REJECTED)

ALTER TABLE growth.asset DROP CONSTRAINT IF EXISTS asset_status_check;

UPDATE growth.asset
SET status = 'IN_REVIEW'
WHERE status = 'PENDING_COMPLIANCE';

ALTER TABLE growth.asset
  ADD CONSTRAINT asset_status_check
  CHECK (status IN ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'RETIRED'));

ALTER TABLE growth.asset
  ADD COLUMN IF NOT EXISTS body jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS claim_checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS review_comment text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS parent_asset_id uuid REFERENCES growth.asset (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version_hash text;

-- FAQ_ANSWER structured fields (also mirrored in body for portability)
ALTER TABLE growth.asset
  ADD COLUMN IF NOT EXISTS question_patterns text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS answer_text text;

CREATE INDEX IF NOT EXISTS asset_status_idx ON growth.asset (status);
CREATE INDEX IF NOT EXISTS asset_type_status_idx ON growth.asset (type, status);
CREATE INDEX IF NOT EXISTS asset_faq_patterns_idx
  ON growth.asset USING gin (question_patterns)
  WHERE type = 'FAQ_ANSWER';

-- Active sequences that reference an asset id in steps jsonb
CREATE OR REPLACE FUNCTION growth.asset_active_sequence_refs(p_asset_id uuid)
RETURNS TABLE (sequence_id uuid)
LANGUAGE sql
STABLE
SET search_path = growth
AS $$
  SELECT s.id
  FROM growth.sequence s
  WHERE s.active = true
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(s.steps, '[]'::jsonb)) AS step
      WHERE step->>'asset_id' = p_asset_id::text
         OR step->>'asset_ref' = ('asset:' || p_asset_id::text)
    );
$$;

REVOKE ALL ON FUNCTION growth.asset_active_sequence_refs(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION growth.asset_active_sequence_refs(uuid)
  TO authenticated, service_role, growth_app;
