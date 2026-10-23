-- App icons are an object bounded in size, readable by a signed-in person through the existing
-- own-devices row policy, and written only through the service-role device exchange.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'jarvis_devices'
      AND column_name = 'app_icons' AND data_type = 'jsonb' AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'jarvis_devices.app_icons is missing or not a required jsonb column';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.jarvis_devices'::regclass AND conname = 'jarvis_devices_app_icons_shape'
  ) THEN
    RAISE EXCEPTION 'The app icon size bound is missing';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.jarvis_devices', 'app_icons', 'SELECT')
    OR has_column_privilege('authenticated', 'public.jarvis_devices', 'app_icons', 'UPDATE') THEN
    RAISE EXCEPTION 'A signed-in person must read app icons and never write them';
  END IF;
END
$$;
