
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS appearance_cursor text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS appearance_cursor_custom text,
  ADD COLUMN IF NOT EXISTS appearance_cursor_size integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS appearance_cursor_trail boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS appearance_low_performance boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_appearance_cursor_chk
  CHECK (appearance_cursor IN ('system','caera_black','caera_white','auto_contrast','custom','accessibility'));

ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_appearance_cursor_size_chk
  CHECK (appearance_cursor_size BETWEEN 16 AND 64);
