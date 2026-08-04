-- Verification for 20260721133830 (activity_log, browser_grants, enums, device uniqueness).
DO $$
BEGIN
  IF to_regclass('public.activity_log')  IS NULL THEN RAISE EXCEPTION 'missing table activity_log'; END IF;
  IF to_regclass('public.browser_grants') IS NULL THEN RAISE EXCEPTION 'missing table browser_grants'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('activity_log','browser_grants')
      AND c.relrowsecurity=false
  ) THEN RAISE EXCEPTION 'RLS not enabled on activity_log/browser_grants'; END IF;

  PERFORM 1 FROM pg_type WHERE typname='main_purpose_kind';   IF NOT FOUND THEN RAISE EXCEPTION 'missing enum main_purpose_kind'; END IF;
  PERFORM 1 FROM pg_type WHERE typname='compliance_category'; IF NOT FOUND THEN RAISE EXCEPTION 'missing enum compliance_category'; END IF;

  PERFORM 1 FROM pg_indexes WHERE schemaname='public' AND indexname='devices_user_physical_pc_uniq';
  IF NOT FOUND THEN RAISE EXCEPTION 'missing unique index devices_user_physical_pc_uniq'; END IF;

  RAISE NOTICE 'verify 20260721133830 OK';
END $$;
