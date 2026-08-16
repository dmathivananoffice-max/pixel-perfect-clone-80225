
-- ============================================================
-- Phase 1: Authentication + Row Level Security Hardening
-- ============================================================

-- 1. Role helper functions (SECURITY DEFINER, avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.current_role_key()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role_key FROM public.app_users
  WHERE auth_user_id = auth.uid() AND active = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_role(_role_key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE auth_user_id = auth.uid()
      AND active = true
      AND role_key = _role_key
  )
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_role_keys text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE auth_user_id = auth.uid()
      AND active = true
      AND role_key = ANY(_role_keys)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_any_role(ARRAY['super_admin','managing_director']);
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_any_role(ARRAY[
    'super_admin','managing_director','operations_manager',
    'sales_executive','recruiter','documentation_officer',
    'german_trainer'
  ]);
$$;

-- 2. Auto-provision app_users row on auth user creation
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _role text;
  _name text;
BEGIN
  -- Founder is bootstrapped as super_admin. All other new signups default to
  -- inactive with role 'candidate' until an admin activates + assigns a role.
  IF NEW.email = 'deeban@workforce-europe.com' THEN
    _role := 'super_admin';
  ELSE
    _role := 'candidate';
  END IF;

  _name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.app_users (auth_user_id, email, full_name, role_key, active)
  VALUES (
    NEW.id,
    NEW.email,
    _name,
    _role,
    _role = 'super_admin'  -- founder auto-active; others must be activated
  )
  ON CONFLICT (email) DO UPDATE
    SET auth_user_id = EXCLUDED.auth_user_id
    WHERE public.app_users.auth_user_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 3. Protect the last super admin (no delete, no deactivate, no demote)
CREATE OR REPLACE FUNCTION public.protect_last_super_admin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _remaining int;
BEGIN
  IF TG_OP = 'DELETE' AND OLD.role_key = 'super_admin' THEN
    SELECT count(*) INTO _remaining FROM public.app_users
      WHERE role_key = 'super_admin' AND active = true AND id <> OLD.id;
    IF _remaining = 0 THEN
      RAISE EXCEPTION 'Cannot delete the last active Super Administrator';
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.role_key = 'super_admin'
        AND (NEW.role_key <> 'super_admin' OR NEW.active = false) THEN
    SELECT count(*) INTO _remaining FROM public.app_users
      WHERE role_key = 'super_admin' AND active = true AND id <> OLD.id;
    IF _remaining = 0 THEN
      RAISE EXCEPTION 'Cannot demote or deactivate the last Super Administrator';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_last_super_admin ON public.app_users;
CREATE TRIGGER trg_protect_last_super_admin
  BEFORE UPDATE OR DELETE ON public.app_users
  FOR EACH ROW EXECUTE FUNCTION public.protect_last_super_admin();

-- 4. Audit events: append-only
CREATE OR REPLACE FUNCTION public.block_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_events are append-only'; END;
$$;

DROP TRIGGER IF EXISTS trg_audit_no_update ON public.audit_events;
CREATE TRIGGER trg_audit_no_update
  BEFORE UPDATE OR DELETE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_mutation();

-- ============================================================
-- 5. Drop ALL existing policies and rebuild strict
-- ============================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies WHERE schemaname='public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Revoke anon everywhere; grant only to authenticated + service_role.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', r.tablename);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', r.tablename);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', r.tablename);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- ============================================================
-- 6. Per-table policies (strict)
-- ============================================================

-- app_users: users read own, admins manage all
CREATE POLICY "own row read" ON public.app_users FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_admin());
CREATE POLICY "admins insert" ON public.app_users FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "admins update" ON public.app_users FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admins delete" ON public.app_users FOR DELETE TO authenticated
  USING (public.is_admin());

-- Roles / permissions catalogs: staff read, super_admin writes
CREATE POLICY "staff read roles" ON public.roles FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "super_admin write roles" ON public.roles FOR ALL TO authenticated
  USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));

CREATE POLICY "staff read permissions" ON public.permissions FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "super_admin write permissions" ON public.permissions FOR ALL TO authenticated
  USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));

CREATE POLICY "staff read role_permissions" ON public.role_permissions FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "super_admin write role_permissions" ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));

-- Products catalog: staff read, admins write
CREATE POLICY "staff read products" ON public.products FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "admins write products" ON public.products FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Candidates & related: staff-only access
CREATE POLICY "staff read candidates" ON public.candidates FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "staff insert candidates" ON public.candidates FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY "staff update candidates" ON public.candidates FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "admins delete candidates" ON public.candidates FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "staff read candidate_documents" ON public.candidate_documents FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "staff insert candidate_documents" ON public.candidate_documents FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY "staff update candidate_documents" ON public.candidate_documents FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "admins delete candidate_documents" ON public.candidate_documents FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "staff read candidate_scores" ON public.candidate_scores FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "staff write candidate_scores" ON public.candidate_scores FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY "staff read document_extractions" ON public.document_extractions FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "staff write document_extractions" ON public.document_extractions FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY "staff read interviews" ON public.interviews FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "staff write interviews" ON public.interviews FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY "staff read assessments" ON public.assessments FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "staff write assessments" ON public.assessments FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY "staff read contracts" ON public.contracts FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "staff write contracts" ON public.contracts FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY "staff read intake_batches" ON public.intake_batches FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "staff write intake_batches" ON public.intake_batches FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY "staff read employers" ON public.employers FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "staff write employers" ON public.employers FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY "staff read agencies" ON public.agencies FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "staff write agencies" ON public.agencies FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Audit trail: staff read; anyone authenticated can append; trigger blocks UPDATE/DELETE
CREATE POLICY "staff read audit" ON public.audit_events FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "authenticated append audit" ON public.audit_events FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- 7. Storage: candidate-documents bucket — staff-only access
-- ============================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname ILIKE '%candidate-documents%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "candidate-documents staff read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'candidate-documents' AND public.is_staff());

CREATE POLICY "candidate-documents staff insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'candidate-documents' AND public.is_staff());

CREATE POLICY "candidate-documents staff update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'candidate-documents' AND public.is_staff())
  WITH CHECK (bucket_id = 'candidate-documents' AND public.is_staff());

CREATE POLICY "candidate-documents admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'candidate-documents' AND public.is_admin());
