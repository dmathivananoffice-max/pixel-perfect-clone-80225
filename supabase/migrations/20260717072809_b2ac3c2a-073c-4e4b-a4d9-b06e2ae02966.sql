
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
