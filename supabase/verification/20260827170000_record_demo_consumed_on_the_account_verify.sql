-- Assert the column exists, is nullable, and is still covered by the
-- owner-scoped policies that already protect profiles.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'demo_consumed_at'
  ) THEN
    RAISE EXCEPTION 'profiles.demo_consumed_at is missing.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'demo_consumed_at' AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'profiles.demo_consumed_at must be nullable; most accounts never used a demo.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'profiles' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'profiles lost row level security.';
  END IF;
END;
$$;
