-- THE BROWSER EXTENSION IS RETIRED (PLAN.md Phase 48, ToRemove.md "Legacy
-- browser bridge"). JARVIS works in the person's own Chrome through the Device
-- Agent (the browser's own remote debugging, no add-on), so OCADE no longer
-- accepts extension devices, and the stop that paused them now pauses phones,
-- which had none of their own.
BEGIN;

-- Any extension still connected stops working at once (its key goes with it).
DELETE FROM public.jarvis_devices WHERE kind = 'extension';
ALTER TABLE public.jarvis_devices DROP CONSTRAINT IF EXISTS jarvis_devices_kind_check;
ALTER TABLE public.jarvis_devices
  ADD CONSTRAINT jarvis_devices_kind_check CHECK (kind IN ('agent', 'android'));

ALTER TABLE public.ocade_service_controls
  DROP CONSTRAINT IF EXISTS ocade_service_controls_key_check;
DELETE FROM public.ocade_service_controls WHERE key = 'jarvis_extension';
INSERT INTO public.ocade_service_controls (key) VALUES ('jarvis_android')
ON CONFLICT (key) DO NOTHING;
ALTER TABLE public.ocade_service_controls
  ADD CONSTRAINT ocade_service_controls_key_check
  CHECK (key IN ('jarvis_execution', 'jarvis_agent', 'jarvis_android'));

COMMIT;
