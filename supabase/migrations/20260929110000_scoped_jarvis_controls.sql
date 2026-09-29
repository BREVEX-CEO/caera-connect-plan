-- Feature-level stops beside the global one (docs/OWNER_ADMIN_BACKEND.md,
-- Security controls): the Device Agent and the browser extension can each be
-- paused on their own. Same function, same second factor, reason and record.
BEGIN;

ALTER TABLE public.ocade_service_controls
  DROP CONSTRAINT IF EXISTS ocade_service_controls_key_check;
ALTER TABLE public.ocade_service_controls
  ADD CONSTRAINT ocade_service_controls_key_check
  CHECK (key IN ('jarvis_execution', 'jarvis_agent', 'jarvis_extension'));

INSERT INTO public.ocade_service_controls (key)
VALUES ('jarvis_agent'), ('jarvis_extension')
ON CONFLICT (key) DO NOTHING;

COMMIT;
