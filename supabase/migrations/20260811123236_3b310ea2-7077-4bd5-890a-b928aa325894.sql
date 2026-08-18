DO $$
DECLARE tbl record;
BEGIN
  FOR tbl IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE c.relkind='r' AND n.nspname='public' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', tbl.relname);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl.relname);
  END LOOP;
END $$;

DO $$
DECLARE p record; sql text;
BEGIN
  FOR p IN
    SELECT tablename, policyname, cmd
      FROM pg_policies
     WHERE schemaname='public' AND 'authenticated'=ANY(roles)
  LOOP
    IF EXISTS (SELECT 1 FROM pg_policies q WHERE q.schemaname='public'
               AND q.tablename=p.tablename AND 'anon'=ANY(q.roles) AND q.cmd=p.cmd) THEN
      CONTINUE;
    END IF;
    IF p.cmd IN ('SELECT','DELETE') THEN
      sql := format('CREATE POLICY %I ON public.%I FOR %s TO anon USING (true)',
        'Anon dev bypass '||p.tablename||' '||p.cmd, p.tablename, p.cmd);
    ELSIF p.cmd = 'INSERT' THEN
      sql := format('CREATE POLICY %I ON public.%I FOR INSERT TO anon WITH CHECK (true)',
        'Anon dev bypass '||p.tablename||' INSERT', p.tablename);
    ELSIF p.cmd = 'UPDATE' THEN
      sql := format('CREATE POLICY %I ON public.%I FOR UPDATE TO anon USING (true) WITH CHECK (true)',
        'Anon dev bypass '||p.tablename||' UPDATE', p.tablename);
    ELSIF p.cmd = 'ALL' THEN
      sql := format('CREATE POLICY %I ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true)',
        'Anon dev bypass '||p.tablename||' ALL', p.tablename);
    ELSE CONTINUE;
    END IF;
    EXECUTE sql;
  END LOOP;
END $$;

CREATE POLICY "Anon read candidate docs"   ON storage.objects FOR SELECT TO anon USING (bucket_id='candidate-documents');
CREATE POLICY "Anon write candidate docs"  ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id='candidate-documents');
CREATE POLICY "Anon update candidate docs" ON storage.objects FOR UPDATE TO anon USING (bucket_id='candidate-documents') WITH CHECK (bucket_id='candidate-documents');
CREATE POLICY "Anon delete candidate docs" ON storage.objects FOR DELETE TO anon USING (bucket_id='candidate-documents');
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

CREATE INDEX IF NOT EXISTS idx_candidate_documents_sha256
  ON public.candidate_documents (sha256);

CREATE UNIQUE INDEX IF NOT EXISTS uq_candidate_documents_candidate_sha
  ON public.candidate_documents (candidate_id, sha256)
  WHERE sha256 IS NOT NULL;

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