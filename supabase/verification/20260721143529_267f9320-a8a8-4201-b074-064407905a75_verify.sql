-- Verification for 20260721143529 (CANIA tables).
DO $$
BEGIN
  IF to_regclass('public.cania_saved_topics') IS NULL THEN RAISE EXCEPTION 'missing table cania_saved_topics'; END IF;
  IF to_regclass('public.cania_alert_prefs')  IS NULL THEN RAISE EXCEPTION 'missing table cania_alert_prefs'; END IF;
  IF to_regclass('public.cania_settings')     IS NULL THEN RAISE EXCEPTION 'missing table cania_settings'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('cania_saved_topics','cania_alert_prefs','cania_settings')
      AND c.relrowsecurity=false
  ) THEN RAISE EXCEPTION 'RLS not enabled on cania tables'; END IF;
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='cania_saved_topics' AND policyname='own_saved_topics';
  IF NOT FOUND THEN RAISE EXCEPTION 'missing policy own_saved_topics'; END IF;
  RAISE NOTICE 'verify 20260721143529 OK';
END $$;
