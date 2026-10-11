-- Undo: frames lose their capture time again.
BEGIN;
ALTER TABLE public.jarvis_tasks DROP COLUMN IF EXISTS live_frame_at;
COMMIT;
