-- Rollback for 20260721134651 (user_settings appearance columns + constraints). Idempotent.
BEGIN;
ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_appearance_cursor_size_chk;
ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_appearance_cursor_chk;
ALTER TABLE public.user_settings
  DROP COLUMN IF EXISTS appearance_low_performance,
  DROP COLUMN IF EXISTS appearance_cursor_trail,
  DROP COLUMN IF EXISTS appearance_cursor_size,
  DROP COLUMN IF EXISTS appearance_cursor_custom,
  DROP COLUMN IF EXISTS appearance_cursor;
COMMIT;
