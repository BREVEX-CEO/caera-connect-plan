-- Verification for 20260721142438 (OCADE conversations + messages).
DO $$
BEGIN
  IF to_regclass('public.ocade_conversations') IS NULL THEN RAISE EXCEPTION 'missing table ocade_conversations'; END IF;
  IF to_regclass('public.ocade_messages')      IS NULL THEN RAISE EXCEPTION 'missing table ocade_messages'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('ocade_conversations','ocade_messages')
      AND c.relrowsecurity=false
  ) THEN RAISE EXCEPTION 'RLS not enabled on ocade conversation tables'; END IF;

  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='ocade_conversations' AND policyname='own_conversations';
  IF NOT FOUND THEN RAISE EXCEPTION 'missing policy own_conversations'; END IF;
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='ocade_messages' AND policyname='own_messages';
  IF NOT FOUND THEN RAISE EXCEPTION 'missing policy own_messages'; END IF;

  RAISE NOTICE 'verify 20260721142438 OK';
END $$;
