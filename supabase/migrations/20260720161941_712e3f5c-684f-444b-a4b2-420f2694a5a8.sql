
-- ============================================================
-- Communications center: email log + clean mock seed
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(candidate_id) ON DELETE SET NULL,
  employer_id UUID REFERENCES public.employers(id) ON DELETE SET NULL,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT,
  template_name TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  error_message TEXT,
  provider_message_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;
GRANT SELECT ON public.email_logs TO anon;

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read email_logs" ON public.email_logs FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "staff write email_logs" ON public.email_logs FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Dev anon email_logs" ON public.email_logs FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_email_logs_candidate ON public.email_logs (candidate_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs (status);

CREATE TRIGGER trg_email_logs_updated_at
  BEFORE UPDATE ON public.email_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Remove mock candidates seeded during early development
DELETE FROM public.candidates
WHERE email IN (
  'ana.martinez@example.com','lars.jensen@example.com','sofia.rossi@example.com',
  'hans.mueller@example.com','emma.dubois@example.com','mateusz.nowak@example.com',
  'katarina.novak@example.com','pierre.martin@example.com','elena.kovacs@example.com',
  'niklas.lindqvist@example.com'
);
