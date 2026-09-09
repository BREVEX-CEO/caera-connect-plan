-- Verifies 20260909200000_ocade_monitors_and_browser_policy.sql.

DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['ocade_monitors', 'ocade_browser_site_policy'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = target
    ) THEN
      RAISE EXCEPTION '% is missing', target;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_class
      WHERE relname = target AND relnamespace = 'public'::regnamespace AND relrowsecurity
    ) THEN
      RAISE EXCEPTION '% does not have row-level security enabled', target;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = target) THEN
      RAISE EXCEPTION '% has row-level security and no policy, so it is unreadable', target;
    END IF;
  END LOOP;

  -- One policy per account. Two rows would be two answers to "may OCADE act
  -- here", and whichever the code read first would win.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ocade_browser_site_policy'::regclass AND contype = 'p'
      -- Cast to text: `attname` is the `name` type, and there is no
      -- `name[] = text[]` operator, so the comparison errors rather than
      -- returning false.
      AND (SELECT array_agg(attname::text ORDER BY attname)
             FROM pg_attribute
            WHERE attrelid = conrelid AND attnum = ANY(conkey)) = ARRAY['user_id']
  ) THEN
    RAISE EXCEPTION 'ocade_browser_site_policy is not keyed one row per account';
  END IF;

  -- Refusal is the default: no row, and no origin, means nothing is allowed.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'ocade_browser_site_policy'
      AND c.column_name = 'allow_origins' AND c.column_default LIKE '%{}%'
  ) THEN
    RAISE EXCEPTION 'ocade_browser_site_policy.allow_origins does not default to allowing nothing';
  END IF;

  -- A stored `allow_private` would be a place for "never" to become a setting.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'ocade_browser_site_policy'
      AND c.column_name = 'allow_private'
  ) THEN
    RAISE EXCEPTION 'acting in a private context has become storable, and it must not be';
  END IF;

  -- A monitor with no sources would have to invent its answers.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ocade_monitors'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%array_length%'
  ) THEN
    RAISE EXCEPTION 'ocade_monitors accepts a monitor with no sources';
  END IF;
END $$;
