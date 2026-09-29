-- Keep only the global stop.
BEGIN;
DELETE FROM public.ocade_service_controls WHERE key IN ('jarvis_agent', 'jarvis_extension');
ALTER TABLE public.ocade_service_controls DROP CONSTRAINT IF EXISTS ocade_service_controls_key_check;
ALTER TABLE public.ocade_service_controls
  ADD CONSTRAINT ocade_service_controls_key_check CHECK (key IN ('jarvis_execution'));
COMMIT;
