-- Rollback of 20261121170000: verified tasks can no longer be replayed.
BEGIN;
DROP FUNCTION IF EXISTS public.jarvis_task_device(uuid);
DROP FUNCTION IF EXISTS public.jarvis_set_replay(uuid, uuid, jsonb);
COMMIT;
