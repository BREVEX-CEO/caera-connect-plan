-- Verifies the appearance depth columns and their range constraint exist.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_settings'
      AND column_name = 'appearance_depth_3d'
  ) THEN
    RAISE EXCEPTION 'user_settings.appearance_depth_3d is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_settings'
      AND column_name = 'appearance_depth_strength'
  ) THEN
    RAISE EXCEPTION 'user_settings.appearance_depth_strength is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'user_settings_depth_strength_range'
      AND conrelid = 'public.user_settings'::regclass
  ) THEN
    RAISE EXCEPTION 'depth strength range constraint is missing';
  END IF;
END;
$$;
