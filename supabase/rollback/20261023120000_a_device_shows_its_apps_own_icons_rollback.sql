-- Removes the app icons a device sent. Names (installed_apps) and Allowed Apps are untouched;
-- the @ picker falls back to its neutral glyph. Icons are re-sent by each device on its next look.
BEGIN;

REVOKE SELECT (app_icons) ON public.jarvis_devices FROM authenticated;
ALTER TABLE public.jarvis_devices DROP CONSTRAINT IF EXISTS jarvis_devices_app_icons_shape;
ALTER TABLE public.jarvis_devices DROP COLUMN IF EXISTS app_icons;

COMMIT;
