-- Undo the per-source enrollment cap: pending enrollments forget where they came
-- from and only the global cap remains (the server must be rolled back first).
BEGIN;
DROP INDEX IF EXISTS public.jarvis_devices_pending_source_idx;
ALTER TABLE public.jarvis_devices DROP CONSTRAINT IF EXISTS jarvis_devices_enrollment_source_shape;
ALTER TABLE public.jarvis_devices DROP COLUMN IF EXISTS enrollment_source;
COMMIT;
