-- Rollback for the appearance depth columns on user_settings.
--
-- Dropping the columns discards each account's saved depth preference, which
-- is a preference and not a record of anything owed — safe to lose. The range
-- constraint goes first so a partial re-run cannot trip over it.

BEGIN;

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_depth_strength_range;

ALTER TABLE public.user_settings
  DROP COLUMN IF EXISTS appearance_depth_strength,
  DROP COLUMN IF EXISTS appearance_depth_3d;

COMMIT;
