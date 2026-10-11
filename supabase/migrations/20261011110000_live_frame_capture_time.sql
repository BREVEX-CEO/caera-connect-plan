-- When the live browser picture was captured, so a stale one is never shown as current (PLAN P15).
BEGIN;
ALTER TABLE public.jarvis_tasks ADD COLUMN IF NOT EXISTS live_frame_at timestamptz;
COMMIT;
