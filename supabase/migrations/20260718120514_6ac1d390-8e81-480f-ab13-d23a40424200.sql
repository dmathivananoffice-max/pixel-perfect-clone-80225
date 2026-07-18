
DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'agencies','app_users','assessments','audit_events','candidate_documents',
  'candidate_scores','candidates','contracts','document_extractions','employers',
  'intake_batches','interviews','permissions','products','role_permissions','roles'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS "dev anon all %s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "dev anon all %s" ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;
