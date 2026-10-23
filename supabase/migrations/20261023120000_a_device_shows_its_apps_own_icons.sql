-- Each app's own icon, as its device found it, for the @ app picker (plan.md §15).
-- Small PNGs by app name, written only by the authenticated device exchange (service role).
-- Additive: a device that never sends icons keeps '{}' and the picker shows a neutral glyph.
BEGIN;

ALTER TABLE public.jarvis_devices ADD COLUMN IF NOT EXISTS app_icons jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.jarvis_devices DROP CONSTRAINT IF EXISTS jarvis_devices_app_icons_shape;
ALTER TABLE public.jarvis_devices ADD CONSTRAINT jarvis_devices_app_icons_shape CHECK (
  jsonb_typeof(app_icons) = 'object' AND pg_column_size(app_icons) <= 2097152
);
GRANT SELECT (app_icons) ON public.jarvis_devices TO authenticated;

COMMIT;
