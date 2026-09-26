-- Prove devices are identified by public keys only, pending enrollments belong
-- to nobody, and one device and one controller own an unfinished task.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'jarvis_devices'
                AND column_name IN ('token_hash', 'pairing_code_hash', 'pairing_expires_at')) THEN
    RAISE EXCEPTION 'shared device secrets or pairing codes still exist';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jarvis_devices_pending_shape') THEN
    RAISE EXCEPTION 'a pending enrollment can hold an account or an account row can expire';
  END IF;
  IF has_column_privilege('authenticated', 'public.jarvis_devices', 'public_key', 'SELECT')
     OR has_column_privilege('authenticated', 'public.jarvis_devices', 'last_request_ms', 'SELECT')
     OR has_table_privilege('authenticated', 'public.jarvis_devices', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.jarvis_devices', 'INSERT') THEN
    RAISE EXCEPTION 'a browser can read device key material or write device records';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'jarvis_tasks_one_open_per_device') THEN
    RAISE EXCEPTION 'a device can run two unfinished tasks at once';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'jarvis_tasks'
                    AND column_name IN ('controller')) THEN
    RAISE EXCEPTION 'tasks have no single controller';
  END IF;
END
$$;
