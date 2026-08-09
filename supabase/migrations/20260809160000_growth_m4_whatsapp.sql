-- M4 WhatsApp qualification agent (FR-W-01 … FR-W-10)

ALTER TABLE growth.conversation
  ADD COLUMN IF NOT EXISTS wa_phone text,
  ADD COLUMN IF NOT EXISTS last_inbound_at timestamptz,
  ADD COLUMN IF NOT EXISTS tokens_in_total int NOT NULL DEFAULT 0
    CHECK (tokens_in_total >= 0),
  ADD COLUMN IF NOT EXISTS tokens_out_total int NOT NULL DEFAULT 0
    CHECK (tokens_out_total >= 0),
  ADD COLUMN IF NOT EXISTS low_confidence_streak int NOT NULL DEFAULT 0
    CHECK (low_confidence_streak >= 0),
  ADD COLUMN IF NOT EXISTS agent_state text NOT NULL DEFAULT 'active'
    CHECK (agent_state IN ('active', 'escalated', 'closed')),
  ADD COLUMN IF NOT EXISTS qualification_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS opt_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_outbound_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS diagnostic_summary text;

CREATE UNIQUE INDEX IF NOT EXISTS conversation_wa_phone_open_uidx
  ON growth.conversation (wa_phone)
  WHERE closed_at IS NULL AND wa_phone IS NOT NULL;

ALTER TABLE growth.llm_usage
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES growth.conversation (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES growth.lead (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS purpose text;

CREATE TABLE IF NOT EXISTS growth.wa_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  language text NOT NULL DEFAULT 'en',
  body text NOT NULL,
  meta_template_name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS growth.counselling_slot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  capacity int NOT NULL DEFAULT 1 CHECK (capacity > 0),
  booked int NOT NULL DEFAULT 0 CHECK (booked >= 0),
  lead_id uuid REFERENCES growth.lead (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'BOOKED', 'CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT counselling_slot_capacity_chk CHECK (booked <= capacity)
);

CREATE TABLE IF NOT EXISTS growth.filter_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES growth.conversation (id) ON DELETE SET NULL,
  lead_id uuid REFERENCES growth.lead (id) ON DELETE SET NULL,
  direction text NOT NULL DEFAULT 'outbound'
    CHECK (direction IN ('outbound', 'draft')),
  original_text text NOT NULL,
  matched_rules text[] NOT NULL DEFAULT '{}',
  action text NOT NULL DEFAULT 'blocked',
  fallback_text text,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS growth.counsellor_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES growth.lead (id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES growth.conversation (id) ON DELETE SET NULL,
  reason text NOT NULL,
  trigger_code text NOT NULL,
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high')),
  status text NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'CLAIMED', 'DONE')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_by uuid,
  claimed_at timestamptz
);

CREATE INDEX IF NOT EXISTS filter_log_conversation_idx
  ON growth.filter_log (conversation_id, at DESC);
CREATE INDEX IF NOT EXISTS counsellor_queue_open_idx
  ON growth.counsellor_queue (status, created_at)
  WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS counselling_slot_open_idx
  ON growth.counselling_slot (starts_at)
  WHERE status = 'OPEN';

ALTER TABLE growth.wa_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth.counselling_slot ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth.filter_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth.counsellor_queue ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON
  growth.wa_template, growth.counselling_slot, growth.filter_log, growth.counsellor_queue
TO growth_app, service_role, growth_agent_whatsapp;

GRANT SELECT, INSERT ON growth.filter_log, growth.counsellor_queue TO authenticated;

INSERT INTO growth.config (key, value, version, active, updated_by)
VALUES
  (
    'whatsapp_token_budget',
    '{"max_tokens_in": 8000, "max_tokens_out": 4000, "max_total": 10000}'::jsonb,
    1, true, 'm4-migration'
  ),
  (
    'whatsapp_faq_retrieval',
    '{"similarity_threshold": 0.42, "max_results": 3}'::jsonb,
    1, true, 'm4-migration'
  ),
  (
    'objection_taxonomy_v1',
    '{"codes":["COST","TRUST/FRAUD-FEAR","VISA-RISK","LANGUAGE-DIFFICULTY","PARENT-APPROVAL","RECOGNITION-RISK","TIMELINE","COMPETITOR-COMPARISON","SAFETY-ABROAD","SELF-DOUBT","UNCLASSIFIED"]}'::jsonb,
    1, true, 'm4-migration'
  )
ON CONFLICT (key, version) DO NOTHING;

INSERT INTO growth.wa_template (name, language, body, meta_template_name, status)
VALUES
  (
    'session_reopen',
    'en',
    'Hi from Workforce Europe — reply here if you would like to continue, or reply ADVISOR for a human advisor.',
    'wfe_session_reopen',
    'ACTIVE'
  ),
  (
    'escalation_ack',
    'en',
    'Thanks — a human advisor has been notified and will follow up. Reply ADVISOR anytime.',
    'wfe_escalation_ack',
    'ACTIVE'
  )
ON CONFLICT (name) DO NOTHING;

INSERT INTO growth.counselling_slot (starts_at, ends_at, timezone, capacity, status)
VALUES
  (now() + interval '1 day' + time '10:00', now() + interval '1 day' + time '10:30', 'Asia/Kolkata', 1, 'OPEN'),
  (now() + interval '1 day' + time '15:00', now() + interval '1 day' + time '15:30', 'Asia/Kolkata', 1, 'OPEN'),
  (now() + interval '2 day' + time '11:00', now() + interval '2 day' + time '11:30', 'Asia/Kolkata', 1, 'OPEN');
