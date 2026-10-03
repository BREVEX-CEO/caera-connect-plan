-- OCADE for Android connects a phone as a JARVIS device of its own kind: the
-- same signed protocol, key and approval as a computer's Device Agent.
ALTER TABLE public.jarvis_devices DROP CONSTRAINT IF EXISTS jarvis_devices_kind_check;
ALTER TABLE public.jarvis_devices
  ADD CONSTRAINT jarvis_devices_kind_check CHECK (kind IN ('agent', 'extension', 'android'));
