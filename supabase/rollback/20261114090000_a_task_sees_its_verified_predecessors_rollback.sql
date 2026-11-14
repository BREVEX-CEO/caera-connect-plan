-- Rollback of 20261114090000: the planner no longer reads earlier verified routes.
BEGIN;
DROP FUNCTION IF EXISTS public.jarvis_experience(uuid);
COMMIT;
