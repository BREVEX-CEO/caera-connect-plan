-- Verifies the subscriptions table, its RLS policy and the entitlement helper.
-- Raises instead of printing, so a gap fails the run rather than scrolling past.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'subscriptions' AND c.relkind = 'r'
  ) THEN
    RAISE EXCEPTION 'public.subscriptions is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'subscriptions' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'row level security is not enabled on public.subscriptions';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscriptions'
      AND policyname = 'Users can view own subscription'
  ) THEN
    RAISE EXCEPTION 'own-subscription select policy is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'has_active_subscription'
  ) THEN
    RAISE EXCEPTION 'public.has_active_subscription() is missing';
  END IF;

  IF has_function_privilege('anon', 'public.has_active_subscription(uuid, text)', 'execute') THEN
    RAISE EXCEPTION 'anon can execute has_active_subscription()';
  END IF;
END;
$$;
