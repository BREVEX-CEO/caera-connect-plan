-- Undo the extension's retirement: the kind and its stop are accepted again
-- (extensions removed by the migration do not come back; each reconnects).
-- The phones' own stop goes.
BEGIN;
ALTER TABLE public.ocade_service_controls
  DROP CONSTRAINT IF EXISTS ocade_service_controls_key_check;
DELETE FROM public.ocade_service_controls WHERE key = 'jarvis_android';
INSERT INTO public.ocade_service_controls (key) VALUES ('jarvis_extension')
ON CONFLICT (key) DO NOTHING;
ALTER TABLE public.ocade_service_controls
  ADD CONSTRAINT ocade_service_controls_key_check
  CHECK (key IN ('jarvis_execution', 'jarvis_agent', 'jarvis_extension'));
ALTER TABLE public.jarvis_devices DROP CONSTRAINT IF EXISTS jarvis_devices_kind_check;
ALTER TABLE public.jarvis_devices
  ADD CONSTRAINT jarvis_devices_kind_check CHECK (kind IN ('agent', 'extension', 'android'));
COMMIT;
