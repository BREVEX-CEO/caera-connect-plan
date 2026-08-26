-- Assert the consent receipt table exists with row-level security, the two
-- owner-scoped policies, the authenticated grants the app needs, and the
-- subscriptions ordering column.

DO $$
BEGIN
  IF to_regclass('public.legal_consent_receipts') IS NULL THEN
    RAISE EXCEPTION 'legal_consent_receipts is missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'legal_consent_receipts' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'legal_consent_receipts does not have row level security enabled.';
  END IF;

  IF (
    SELECT count(*) FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'legal_consent_receipts'
  ) < 2 THEN
    RAISE EXCEPTION 'legal_consent_receipts is missing its owner-scoped policies.';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.legal_consent_receipts', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.legal_consent_receipts', 'INSERT') THEN
    RAISE EXCEPTION 'authenticated lacks read/insert grants on legal_consent_receipts.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
      AND column_name = 'provider_event_at'
  ) THEN
    RAISE EXCEPTION 'subscriptions.provider_event_at is missing.';
  END IF;
END;
$$;
