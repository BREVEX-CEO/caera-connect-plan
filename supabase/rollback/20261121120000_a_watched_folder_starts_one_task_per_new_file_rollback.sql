-- Rollback of 20261121120000: watched folders and their events are removed.
BEGIN;
DROP FUNCTION IF EXISTS public.jarvis_watch_fired(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.jarvis_device_watches(uuid);
DROP FUNCTION IF EXISTS public.jarvis_add_watch(uuid, uuid, uuid, text, text);
DROP INDEX IF EXISTS public.jarvis_schedules_watch_idx;
ALTER TABLE public.jarvis_schedules DROP COLUMN IF EXISTS watch_id;
DROP TABLE IF EXISTS public.jarvis_watch_events;
DROP TABLE IF EXISTS public.jarvis_watches;
COMMIT;
