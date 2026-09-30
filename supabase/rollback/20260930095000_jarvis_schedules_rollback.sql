-- Undo JARVIS schedules: every reminder and scheduled task is removed with the
-- table (the server that reads it must be rolled back first).
BEGIN;
DROP TABLE IF EXISTS public.jarvis_schedules;
COMMIT;
