REVOKE ALL ON FUNCTION public.purge_binned_candidates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_binned_candidates() TO postgres, service_role;