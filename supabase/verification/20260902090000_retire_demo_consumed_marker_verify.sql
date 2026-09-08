-- Assert the demo marker is gone and that profiles is otherwise intact.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'demo_consumed_at'
  ) THEN
    RAISE EXCEPTION 'profiles.demo_consumed_at still exists; the demo entitlement record was not retired.';
  END IF;

  -- Dropping a column must not have taken the table's protection with it.
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'profiles' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'profiles lost row level security.';
  END IF;

  -- And the columns the product actually reads are still there.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id'
  ) THEN
    RAISE EXCEPTION 'profiles.id is missing.';
  END IF;
END;
$$;
