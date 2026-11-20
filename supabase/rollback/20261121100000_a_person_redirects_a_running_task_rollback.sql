-- Rollback of 20261121100000: instructions can no longer be added or read; existing notes stay.
BEGIN;
DROP FUNCTION IF EXISTS public.jarvis_task_instructions(uuid);
DROP FUNCTION IF EXISTS public.jarvis_add_instruction(uuid, uuid, uuid, text, smallint, uuid);
DROP INDEX IF EXISTS public.jarvis_activity_one_instruction_per_client;
COMMIT;
