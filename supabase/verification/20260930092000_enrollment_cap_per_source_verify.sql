-- The source column exists, is shaped, indexed for pending rows, and private.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'jarvis_devices' AND column_name = 'enrollment_source'
  ) THEN
    RAISE EXCEPTION 'jarvis_devices.enrollment_source is missing';
  END IF;
  IF to_regclass('public.jarvis_devices_pending_source_idx') IS NULL THEN
    RAISE EXCEPTION 'pending-source index is missing';
  END IF;
  IF has_column_privilege('authenticated', 'public.jarvis_devices', 'enrollment_source', 'SELECT') THEN
    RAISE EXCEPTION 'enrollment_source must not be readable by signed-in people';
  END IF;
END
$$;
