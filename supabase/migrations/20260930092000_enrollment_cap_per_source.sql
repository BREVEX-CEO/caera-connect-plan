-- A pending enrollment remembers where it came from (a hash of the client
-- address), so one source can hold only a few at once. The global cap alone
-- could be filled by one script, stopping every new computer from connecting.
BEGIN;

ALTER TABLE public.jarvis_devices ADD COLUMN IF NOT EXISTS enrollment_source text;
ALTER TABLE public.jarvis_devices DROP CONSTRAINT IF EXISTS jarvis_devices_enrollment_source_shape;
ALTER TABLE public.jarvis_devices ADD CONSTRAINT jarvis_devices_enrollment_source_shape
  CHECK (enrollment_source IS NULL OR enrollment_source ~ '^[0-9a-f]{64}$');

CREATE INDEX IF NOT EXISTS jarvis_devices_pending_source_idx
  ON public.jarvis_devices (enrollment_source) WHERE user_id IS NULL;

-- Not in the column grants to authenticated: nobody reads it but the server.

COMMIT;
