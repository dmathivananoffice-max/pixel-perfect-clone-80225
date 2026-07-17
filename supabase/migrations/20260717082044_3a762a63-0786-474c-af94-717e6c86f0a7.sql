-- Extend candidate_documents with fingerprint + OCR pipeline columns
ALTER TABLE public.candidate_documents
  ADD COLUMN IF NOT EXISTS sha256 TEXT,
  ADD COLUMN IF NOT EXISTS upload_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS standardized_filename TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_by_name TEXT,
  ADD COLUMN IF NOT EXISTS ocr_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ocr_provider TEXT,
  ADD COLUMN IF NOT EXISTS ocr_version TEXT,
  ADD COLUMN IF NOT EXISTS ocr_raw JSONB,
  ADD COLUMN IF NOT EXISTS ocr_error TEXT,
  ADD COLUMN IF NOT EXISTS ai_model_version TEXT,
  ADD COLUMN IF NOT EXISTS page_count INTEGER,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS document_state TEXT NOT NULL DEFAULT 'draft';

-- ocr_status: pending | processing | complete | failed | skipped
-- document_state: draft | ai_processed | verified | visa_ready

CREATE INDEX IF NOT EXISTS idx_candidate_documents_sha256
  ON public.candidate_documents (sha256);

CREATE UNIQUE INDEX IF NOT EXISTS uq_candidate_documents_candidate_sha
  ON public.candidate_documents (candidate_id, sha256)
  WHERE sha256 IS NOT NULL;

-- Field-level extractions with source traceability
CREATE TABLE IF NOT EXISTS public.document_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(candidate_id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.candidate_documents(id) ON DELETE CASCADE,
  section TEXT NOT NULL DEFAULT 'general',
  field_name TEXT NOT NULL,
  ai_value TEXT,
  human_value TEXT,
  confidence NUMERIC(4,3),
  page_number INTEGER,
  bbox JSONB,
  ocr_provider TEXT,
  ocr_version TEXT,
  ai_model_version TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_extractions TO authenticated;
GRANT ALL ON public.document_extractions TO service_role;
GRANT SELECT ON public.document_extractions TO anon;

ALTER TABLE public.document_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docext_all_authenticated"
  ON public.document_extractions FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_docext_candidate ON public.document_extractions (candidate_id);
CREATE INDEX IF NOT EXISTS idx_docext_document ON public.document_extractions (document_id);

CREATE TRIGGER trg_docext_updated_at
  BEFORE UPDATE ON public.document_extractions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
