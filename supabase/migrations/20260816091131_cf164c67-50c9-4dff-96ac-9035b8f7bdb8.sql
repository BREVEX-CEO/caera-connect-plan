ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS appearance_depth_3d boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS appearance_depth_strength smallint NOT NULL DEFAULT 100;

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_depth_strength_range;

ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_depth_strength_range
  CHECK (appearance_depth_strength BETWEEN 0 AND 200);