-- ROLLBACK for 20260722110000_ocade_automations.sql
--
-- Destructive: drops OCADE automations and their run history.
-- Runs are dropped first (they reference automations).

BEGIN;

DROP INDEX IF EXISTS public.ocade_automation_runs_one_in_flight_idx;
DROP INDEX IF EXISTS public.ocade_automation_runs_user_idx;
DROP INDEX IF EXISTS public.ocade_automation_runs_automation_idx;
DROP TABLE IF EXISTS public.ocade_automation_runs;

DROP TRIGGER IF EXISTS ocade_automations_touch ON public.ocade_automations;
DROP INDEX IF EXISTS public.ocade_automations_due_idx;
DROP INDEX IF EXISTS public.ocade_automations_user_idx;
DROP TABLE IF EXISTS public.ocade_automations;

COMMIT;
