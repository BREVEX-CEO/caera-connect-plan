-- Undo Android devices: connected phones are removed first (their keys stop
-- working), then the kind is no longer accepted.
BEGIN;
DELETE FROM public.jarvis_devices WHERE kind = 'android';
ALTER TABLE public.jarvis_devices DROP CONSTRAINT IF EXISTS jarvis_devices_kind_check;
ALTER TABLE public.jarvis_devices
  ADD CONSTRAINT jarvis_devices_kind_check CHECK (kind IN ('agent', 'extension'));
COMMIT;
