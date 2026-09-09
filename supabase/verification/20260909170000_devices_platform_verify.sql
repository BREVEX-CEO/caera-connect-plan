-- Verifies 20260909170000_devices_platform.sql.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'devices' AND c.column_name = 'platform'
  ) THEN
    RAISE EXCEPTION 'devices.platform is missing';
  END IF;

  -- Nullable on purpose: a row registered before this migration does not know
  -- its platform, and inferring one would show somebody a guess as fact.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'devices'
      AND c.column_name = 'platform' AND c.is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'devices.platform is NOT NULL, so existing rows must claim a platform they do not know';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'devices_user_created_idx'
  ) THEN
    RAISE EXCEPTION 'devices_user_created_idx is missing, so listing devices scans every row';
  END IF;
END $$;
