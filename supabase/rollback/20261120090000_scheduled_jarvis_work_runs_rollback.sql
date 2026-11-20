-- Rollback of 20261120090000: the schedule save, pause/resume, claim and finish steps are removed.
-- The schedules table itself predates this migration and stays.
BEGIN;
DROP FUNCTION IF EXISTS public.jarvis_finish_schedule(uuid, timestamptz, timestamptz, text);
DROP FUNCTION IF EXISTS public.jarvis_claim_due_schedules(timestamptz, integer);
DROP FUNCTION IF EXISTS public.jarvis_set_schedule_active(uuid, uuid, boolean, timestamptz);
DROP FUNCTION IF EXISTS public.jarvis_save_schedule(uuid, uuid, uuid, uuid, text, timestamptz, text, text);
COMMIT;
