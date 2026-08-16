-- shared updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ candidates ============
CREATE TABLE public.candidates (
  candidate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dob DATE,
  gender TEXT,
  country TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  highest_qualification TEXT,
  product_id TEXT NOT NULL,
  program_name TEXT,
  source_type TEXT NOT NULL DEFAULT 'internal',
  source_agency_id UUID,
  source_agency_name TEXT,
  assigned_recruiter_id UUID,
  assigned_recruiter_name TEXT,
  status TEXT NOT NULL DEFAULT 'waiting',
  gate_status TEXT NOT NULL DEFAULT 'not_placement_ready',
  total_score NUMERIC,
  rank INTEGER,
  is_mock BOOLEAN NOT NULL DEFAULT false,
  verification_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  extracted_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT ALL ON public.candidates TO service_role;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read candidates" ON public.candidates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert candidates" ON public.candidates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update candidates" ON public.candidates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete candidates" ON public.candidates FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_candidates_updated BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_candidates_product ON public.candidates(product_id);
CREATE INDEX idx_candidates_status ON public.candidates(status);

-- ============ candidate_documents ============
CREATE TABLE public.candidate_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(candidate_id) ON DELETE CASCADE,
  document_type TEXT NOT NULL DEFAULT 'other',
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  version INTEGER NOT NULL DEFAULT 1,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  ocr_complete BOOLEAN NOT NULL DEFAULT false,
  ocr_confidence NUMERIC,
  extracted_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  expiry_date DATE,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_documents TO authenticated;
GRANT ALL ON public.candidate_documents TO service_role;
ALTER TABLE public.candidate_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage candidate_documents" ON public.candidate_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_candidate_documents_updated BEFORE UPDATE ON public.candidate_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_candidate_documents_candidate ON public.candidate_documents(candidate_id);

-- ============ intake_batches ============
CREATE TABLE public.intake_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'bulk',
  status TEXT NOT NULL DEFAULT 'processing',
  total_files INTEGER NOT NULL DEFAULT 0,
  total_candidates INTEGER NOT NULL DEFAULT 0,
  resume_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_batches TO authenticated;
GRANT ALL ON public.intake_batches TO service_role;
ALTER TABLE public.intake_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage intake_batches" ON public.intake_batches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_intake_batches_updated BEFORE UPDATE ON public.intake_batches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Link candidates to their intake batch (nullable — direct-added candidates have none)
ALTER TABLE public.candidates ADD COLUMN batch_id UUID REFERENCES public.intake_batches(id) ON DELETE SET NULL;
CREATE INDEX idx_candidates_batch ON public.candidates(batch_id);

-- ============ audit_events ============
CREATE TABLE public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  actor_id UUID,
  actor_name TEXT,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read audit" ON public.audit_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write audit" ON public.audit_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX idx_audit_entity ON public.audit_events(entity_type, entity_id);

-- ============ storage RLS for candidate-documents bucket ============
CREATE POLICY "Authenticated read candidate docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'candidate-documents');
CREATE POLICY "Authenticated write candidate docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'candidate-documents');
CREATE POLICY "Authenticated update candidate docs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'candidate-documents');
CREATE POLICY "Authenticated delete candidate docs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'candidate-documents');

-- ============ Seed: 2 clearly-labeled mock candidates per product ============
INSERT INTO public.candidates
  (first_name, last_name, country, email, phone, product_id, program_name, status, gate_status, source_type, total_score, is_mock) VALUES
  ('Mock 1',  'Nurses',       'India',       'mock1.nurses@example.com',       '+91-000-0001', 'nurses',       'Professional Nurses', 'shortlisted', 'eligible',              'internal', 82, true),
  ('Mock 2',  'Nurses',       'Philippines', 'mock2.nurses@example.com',       '+63-000-0002', 'nurses',       'Professional Nurses', 'interview1',  'eligible',              'agency',   74, true),
  ('Mock 1',  'Ausbildung',   'India',       'mock1.ausbildung@example.com',   '+91-000-0003', 'ausbildung',   'Ausbildung',          'waiting',     'not_placement_ready',   'internal', 61, true),
  ('Mock 2',  'Ausbildung',   'Vietnam',     'mock2.ausbildung@example.com',   '+84-000-0004', 'ausbildung',   'Ausbildung',          'contract',    'eligible',              'direct',   88, true),
  ('Mock 1',  'PreBachelor',  'India',       'mock1.prebachelor@example.com',  '+91-000-0005', 'pre_bachelor', 'Pre-Bachelor',        'shortlisted', 'eligible',              'internal', 70, true),
  ('Mock 2',  'PreBachelor',  'Nepal',       'mock2.prebachelor@example.com',  '+977-000-0006','pre_bachelor', 'Pre-Bachelor',        'visa',        'eligible',              'internal', 79, true),
  ('Mock 1',  'PreMasters',   'India',       'mock1.premasters@example.com',   '+91-000-0007', 'pre_masters',  'Pre-Masters',         'interview2',  'eligible',              'internal', 85, true),
  ('Mock 2',  'PreMasters',   'Pakistan',    'mock2.premasters@example.com',   '+92-000-0008', 'pre_masters',  'Pre-Masters',         'placed',      'eligible',              'internal', 91, true),
  ('Mock 1',  'MBA',          'India',       'mock1.mba@example.com',          '+91-000-0009', 'mba',          'MBA',                 'shortlisted', 'eligible',              'internal', 76, true),
  ('Mock 2',  'MBA',          'Bangladesh',  'mock2.mba@example.com',          '+880-000-0010','mba',          'MBA',                 'rejected',    'not_placement_ready',   'agency',   42, true);