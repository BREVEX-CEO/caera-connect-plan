-- Rollback of 20261121190000: server actions are no longer counted per person.
BEGIN;
DROP FUNCTION IF EXISTS public.ocade_rate_admit(uuid, text, integer, integer);
DROP TABLE IF EXISTS public.ocade_rate_windows;
COMMIT;
