
-- Revoke public execute on our SECURITY DEFINER helpers; only authenticated can call.
REVOKE EXECUTE ON FUNCTION public.current_role_key() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_role_key() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- Tighten audit append: must be signed in and either acting on own behalf or staff.
DROP POLICY IF EXISTS "authenticated append audit" ON public.audit_events;
CREATE POLICY "authenticated append audit" ON public.audit_events
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() OR public.is_staff());
