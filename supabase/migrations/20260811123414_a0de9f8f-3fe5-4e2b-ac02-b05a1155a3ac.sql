REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_last_super_admin() FROM PUBLIC, anon, authenticated;

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
CREATE POLICY "staff read email_logs" ON public.email_logs FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "staff write email_logs" ON public.email_logs FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE INDEX IF NOT EXISTS idx_email_logs_candidate ON public.email_logs(candidate_id);

DELETE FROM public.candidates WHERE is_mock = true;