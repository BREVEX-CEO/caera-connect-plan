BEGIN;

DROP FUNCTION public.jarvis_device_admit(uuid, bigint, integer, integer);
ALTER TABLE public.jarvis_devices DROP COLUMN request_window_count;
ALTER TABLE public.jarvis_devices DROP COLUMN request_window_started_ms;

COMMIT;
