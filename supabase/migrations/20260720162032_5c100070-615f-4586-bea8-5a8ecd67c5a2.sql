
-- Drop any existing policies for these buckets to avoid duplicates
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND (policyname ILIKE '%email-attachments%' OR policyname ILIKE '%resumes%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- email-attachments: staff access
CREATE POLICY "email-attachments staff read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'email-attachments' AND public.is_staff());

CREATE POLICY "email-attachments staff insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'email-attachments' AND name LIKE 'email/%' AND public.is_staff());

CREATE POLICY "email-attachments staff update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'email-attachments' AND public.is_staff())
  WITH CHECK (bucket_id = 'email-attachments' AND public.is_staff());

CREATE POLICY "email-attachments admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'email-attachments' AND public.is_admin());

-- resumes: staff access
CREATE POLICY "resumes staff read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'resumes' AND public.is_staff());

CREATE POLICY "resumes staff insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resumes' AND public.is_staff());

CREATE POLICY "resumes staff update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'resumes' AND public.is_staff())
  WITH CHECK (bucket_id = 'resumes' AND public.is_staff());

CREATE POLICY "resumes admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'resumes' AND public.is_admin());

-- Dev anon preview policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='Dev anon read email-attachments'
  ) THEN
    CREATE POLICY "Dev anon read email-attachments"
      ON storage.objects FOR SELECT TO anon USING (bucket_id='email-attachments');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='Dev anon insert email-attachments'
  ) THEN
    CREATE POLICY "Dev anon insert email-attachments"
      ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id='email-attachments');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='Dev anon update email-attachments'
  ) THEN
    CREATE POLICY "Dev anon update email-attachments"
      ON storage.objects FOR UPDATE TO anon USING (bucket_id='email-attachments') WITH CHECK (bucket_id='email-attachments');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='Dev anon delete email-attachments'
  ) THEN
    CREATE POLICY "Dev anon delete email-attachments"
      ON storage.objects FOR DELETE TO anon USING (bucket_id='email-attachments');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='Dev anon read resumes'
  ) THEN
    CREATE POLICY "Dev anon read resumes"
      ON storage.objects FOR SELECT TO anon USING (bucket_id='resumes');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='Dev anon insert resumes'
  ) THEN
    CREATE POLICY "Dev anon insert resumes"
      ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id='resumes');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='Dev anon update resumes'
  ) THEN
    CREATE POLICY "Dev anon update resumes"
      ON storage.objects FOR UPDATE TO anon USING (bucket_id='resumes') WITH CHECK (bucket_id='resumes');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='Dev anon delete resumes'
  ) THEN
    CREATE POLICY "Dev anon delete resumes"
      ON storage.objects FOR DELETE TO anon USING (bucket_id='resumes');
  END IF;
END $$;
