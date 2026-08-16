-- 1. Drop overly-permissive candidate-documents policies
DROP POLICY IF EXISTS "Authenticated read candidate docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated write candidate docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update candidate docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete candidate docs" ON storage.objects;

-- 2. Replace WITH CHECK (true) on audit_events insert with actor scoping
DROP POLICY IF EXISTS "authenticated append audit" ON public.audit_events;
CREATE POLICY "authenticated append audit" ON public.audit_events
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- 3. Fix mutable search_path on block_audit_mutation
CREATE OR REPLACE FUNCTION public.block_audit_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN RAISE EXCEPTION 'audit_events are append-only'; END;
$function$;

-- 4. Revoke EXECUTE on trigger-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_last_super_admin() FROM PUBLIC, anon, authenticated;