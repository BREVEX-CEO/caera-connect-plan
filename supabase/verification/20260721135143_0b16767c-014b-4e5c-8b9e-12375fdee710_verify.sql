-- Verification for 20260721135143 (data_class_privacy + vault_config).
DO $$
BEGIN
  IF to_regclass('public.data_class_privacy') IS NULL THEN RAISE EXCEPTION 'missing table data_class_privacy'; END IF;
  IF to_regclass('public.vault_config')       IS NULL THEN RAISE EXCEPTION 'missing table vault_config'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('data_class_privacy','vault_config')
      AND c.relrowsecurity=false
  ) THEN RAISE EXCEPTION 'RLS not enabled on privacy/vault tables'; END IF;
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='vault_config' AND policyname='vault_config_self_all';
  IF NOT FOUND THEN RAISE EXCEPTION 'missing policy vault_config_self_all'; END IF;
  RAISE NOTICE 'verify 20260721135143 OK';
END $$;
