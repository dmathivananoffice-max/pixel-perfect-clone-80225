
-- Grant usage on schemas
GRANT USAGE ON SCHEMA public TO authenticated, service_role, anon;

-- Grant sequence usage for all public sequences
DO $$
DECLARE s record;
BEGIN
  FOR s IN SELECT c.relname
             FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE c.relkind='S' AND n.nspname='public' LOOP
    EXECUTE format('GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.%I TO authenticated, service_role', s.relname);
  END LOOP;
END $$;

-- Grant execute on safe public functions
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.proname
             FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.prokind='f' LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I TO authenticated, service_role', f.proname);
  END LOOP;
END $$;

-- Keep set_updated_at available to anon too (trigger helper)
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO anon;
