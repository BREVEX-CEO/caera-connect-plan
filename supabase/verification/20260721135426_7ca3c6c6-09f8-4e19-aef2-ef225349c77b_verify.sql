-- Verification for 20260721135426 (user_private_records).
DO $$
BEGIN
  IF to_regclass('public.user_private_records') IS NULL THEN RAISE EXCEPTION 'missing table user_private_records'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='user_private_records' AND c.relrowsecurity=false
  ) THEN RAISE EXCEPTION 'RLS not enabled on user_private_records'; END IF;
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_private_records' AND policyname='upr_self_all';
  IF NOT FOUND THEN RAISE EXCEPTION 'missing policy upr_self_all'; END IF;
  RAISE NOTICE 'verify 20260721135426 OK';
END $$;
