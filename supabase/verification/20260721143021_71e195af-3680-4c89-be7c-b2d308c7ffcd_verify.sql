-- Verification for 20260721143021 (OCADE provider prefs + events).
DO $$
BEGIN
  IF to_regclass('public.ocade_provider_prefs')  IS NULL THEN RAISE EXCEPTION 'missing table ocade_provider_prefs'; END IF;
  IF to_regclass('public.ocade_provider_events') IS NULL THEN RAISE EXCEPTION 'missing table ocade_provider_events'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('ocade_provider_prefs','ocade_provider_events')
      AND c.relrowsecurity=false
  ) THEN RAISE EXCEPTION 'RLS not enabled on ocade provider tables'; END IF;
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='ocade_provider_prefs' AND policyname='own_provider_prefs';
  IF NOT FOUND THEN RAISE EXCEPTION 'missing policy own_provider_prefs'; END IF;
  RAISE NOTICE 'verify 20260721143021 OK';
END $$;
