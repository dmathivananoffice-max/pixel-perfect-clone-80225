
-- ============================================================
-- Local development preview: re-add permissive anon policies
-- ============================================================

DO $$
DECLARE p record; sql text;
BEGIN
  FOR p IN
    SELECT tablename, cmd
      FROM pg_policies
     WHERE schemaname='public' AND 'authenticated'=ANY(roles)
  LOOP
    IF EXISTS (SELECT 1 FROM pg_policies q WHERE q.schemaname='public'
               AND q.tablename=p.tablename AND 'anon'=ANY(q.roles) AND q.cmd=p.cmd) THEN
      CONTINUE;
    END IF;
    IF p.cmd IN ('SELECT','DELETE') THEN
      sql := format('CREATE POLICY %I ON public.%I FOR %s TO anon USING (true)',
        'Dev anon '||p.tablename||' '||p.cmd, p.tablename, p.cmd);
    ELSIF p.cmd = 'INSERT' THEN
      sql := format('CREATE POLICY %I ON public.%I FOR INSERT TO anon WITH CHECK (true)',
        'Dev anon '||p.tablename||' INSERT', p.tablename);
    ELSIF p.cmd = 'UPDATE' THEN
      sql := format('CREATE POLICY %I ON public.%I FOR UPDATE TO anon USING (true) WITH CHECK (true)',
        'Dev anon '||p.tablename||' UPDATE', p.tablename);
    ELSIF p.cmd = 'ALL' THEN
      sql := format('CREATE POLICY %I ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true)',
        'Dev anon '||p.tablename||' ALL', p.tablename);
    ELSE CONTINUE;
    END IF;
    EXECUTE sql;
  END LOOP;
END $$;

-- Grant anon DML on public tables for preview
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon', r.tablename);
  END LOOP;
END $$;

-- Storage preview policies for anon
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Dev anon read candidate docs'
  ) THEN
    CREATE POLICY "Dev anon read candidate docs"
      ON storage.objects FOR SELECT TO anon USING (bucket_id='candidate-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Dev anon insert candidate docs'
  ) THEN
    CREATE POLICY "Dev anon insert candidate docs"
      ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id='candidate-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Dev anon update candidate docs'
  ) THEN
    CREATE POLICY "Dev anon update candidate docs"
      ON storage.objects FOR UPDATE TO anon USING (bucket_id='candidate-documents') WITH CHECK (bucket_id='candidate-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Dev anon delete candidate docs'
  ) THEN
    CREATE POLICY "Dev anon delete candidate docs"
      ON storage.objects FOR DELETE TO anon USING (bucket_id='candidate-documents');
  END IF;
END $$;
