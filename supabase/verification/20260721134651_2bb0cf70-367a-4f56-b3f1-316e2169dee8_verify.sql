-- Verification for 20260721134651 (appearance columns + constraints present).
DO $$
BEGIN
  PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_settings' AND column_name='appearance_cursor';
  IF NOT FOUND THEN RAISE EXCEPTION 'missing column user_settings.appearance_cursor'; END IF;
  PERFORM 1 FROM pg_constraint WHERE conname='user_settings_appearance_cursor_size_chk';
  IF NOT FOUND THEN RAISE EXCEPTION 'missing constraint user_settings_appearance_cursor_size_chk'; END IF;
  RAISE NOTICE 'verify 20260721134651 OK';
END $$;
