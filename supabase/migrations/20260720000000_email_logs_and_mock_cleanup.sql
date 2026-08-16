-- Email Center backing table + removal of seeded mock candidates.
--
-- 1. public.email_logs — every message composed in the Email Center is
--    persisted here (status 'pending' until an outbound mail provider is
--    configured; nothing is silently faked as "sent").
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(candidate_id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  template TEXT NOT NULL DEFAULT 'custom',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage email_logs" ON public.email_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Match the development-posture policies used across the rest of the schema.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_logs TO anon;
CREATE POLICY "dev anon all email_logs" ON public.email_logs
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_email_logs_candidate ON public.email_logs(candidate_id);

-- 2. Remove the seeded demo candidates (is_mock = true) that were inserted
--    by the initial schema migration. Real operating data must not be
--    diluted with fixtures.
DELETE FROM public.candidates WHERE is_mock = true;
