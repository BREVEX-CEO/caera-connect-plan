-- Undo 20261017090000: schedules advance before their work again (an interrupted run is lost).
BEGIN;
DROP INDEX IF EXISTS public.jarvis_tasks_one_per_schedule_occurrence;
ALTER TABLE public.jarvis_tasks DROP CONSTRAINT IF EXISTS jarvis_tasks_schedule_occurrence_check;
ALTER TABLE public.jarvis_tasks DROP COLUMN IF EXISTS schedule_occurrence;
DROP INDEX IF EXISTS public.jarvis_schedules_claimed_idx;
ALTER TABLE public.jarvis_schedules DROP COLUMN IF EXISTS claimed_occurrence;
ALTER TABLE public.jarvis_schedules DROP COLUMN IF EXISTS claimed_at;
COMMIT;
