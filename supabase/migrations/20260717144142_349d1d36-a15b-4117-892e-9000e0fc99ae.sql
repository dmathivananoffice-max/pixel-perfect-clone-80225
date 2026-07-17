GRANT SELECT, INSERT, UPDATE, DELETE ON public.agencies TO authenticated;
GRANT ALL ON public.agencies TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_users TO authenticated;
GRANT ALL ON public.app_users TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessments TO authenticated;
GRANT ALL ON public.assessments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_documents TO authenticated;
GRANT ALL ON public.candidate_documents TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_scores TO authenticated;
GRANT ALL ON public.candidate_scores TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT ALL ON public.candidates TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_extractions TO authenticated;
GRANT ALL ON public.document_extractions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employers TO authenticated;
GRANT ALL ON public.employers TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_batches TO authenticated;
GRANT ALL ON public.intake_batches TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interviews TO authenticated;
GRANT ALL ON public.interviews TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;