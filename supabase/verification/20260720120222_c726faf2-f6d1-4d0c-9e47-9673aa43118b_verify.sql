-- Verification for 20260720120222 (foundational schema).
--
-- Read-only. Each query RAISEs on a missing object so the whole script fails
-- loudly if the migration did not fully apply. Run through Lovable/psql after
-- applying the migration. Never applied automatically here.

DO $$
BEGIN
  -- Enums.
  PERFORM 1 FROM pg_type WHERE typname = 'app_role';    IF NOT FOUND THEN RAISE EXCEPTION 'missing enum app_role'; END IF;
  PERFORM 1 FROM pg_type WHERE typname = 'tenant_kind'; IF NOT FOUND THEN RAISE EXCEPTION 'missing enum tenant_kind'; END IF;
  PERFORM 1 FROM pg_type WHERE typname = 'tenant_role'; IF NOT FOUND THEN RAISE EXCEPTION 'missing enum tenant_role'; END IF;
  PERFORM 1 FROM pg_type WHERE typname = 'device_kind'; IF NOT FOUND THEN RAISE EXCEPTION 'missing enum device_kind'; END IF;
  PERFORM 1 FROM pg_type WHERE typname = 'privacy_mode';IF NOT FOUND THEN RAISE EXCEPTION 'missing enum privacy_mode'; END IF;

  -- Tables exist.
  IF to_regclass('public.profiles')       IS NULL THEN RAISE EXCEPTION 'missing table profiles'; END IF;
  IF to_regclass('public.user_roles')     IS NULL THEN RAISE EXCEPTION 'missing table user_roles'; END IF;
  IF to_regclass('public.tenants')        IS NULL THEN RAISE EXCEPTION 'missing table tenants'; END IF;
  IF to_regclass('public.tenant_members') IS NULL THEN RAISE EXCEPTION 'missing table tenant_members'; END IF;
  IF to_regclass('public.user_settings')  IS NULL THEN RAISE EXCEPTION 'missing table user_settings'; END IF;
  IF to_regclass('public.devices')        IS NULL THEN RAISE EXCEPTION 'missing table devices'; END IF;
  IF to_regclass('public.audit_log')      IS NULL THEN RAISE EXCEPTION 'missing table audit_log'; END IF;
  IF to_regclass('public.feature_flags')  IS NULL THEN RAISE EXCEPTION 'missing table feature_flags'; END IF;

  -- RLS is enabled on every user-data table (the security boundary).
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('profiles','user_roles','tenants','tenant_members',
                        'user_settings','devices','audit_log','feature_flags')
      AND c.relrowsecurity = false
  ) THEN
    RAISE EXCEPTION 'RLS not enabled on one or more core tables';
  END IF;

  -- Own-row policies present (spot-check the identity-critical ones).
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_self_select';
  IF NOT FOUND THEN RAISE EXCEPTION 'missing policy profiles_self_select'; END IF;
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='devices' AND policyname='devices_self_all';
  IF NOT FOUND THEN RAISE EXCEPTION 'missing policy devices_self_all'; END IF;

  -- Helper functions and the signup trigger.
  PERFORM 1 FROM pg_proc WHERE proname='has_role';        IF NOT FOUND THEN RAISE EXCEPTION 'missing function has_role'; END IF;
  PERFORM 1 FROM pg_proc WHERE proname='enforce_device_cap'; IF NOT FOUND THEN RAISE EXCEPTION 'missing function enforce_device_cap'; END IF;
  PERFORM 1 FROM pg_proc WHERE proname='handle_new_user'; IF NOT FOUND THEN RAISE EXCEPTION 'missing function handle_new_user'; END IF;
  PERFORM 1 FROM pg_trigger WHERE tgname='on_auth_user_created';
  IF NOT FOUND THEN RAISE EXCEPTION 'missing trigger on_auth_user_created'; END IF;

  RAISE NOTICE 'verify 20260720120222 OK: 8 tables, 5 enums, RLS enabled, core policies + signup trigger present';
END $$;
