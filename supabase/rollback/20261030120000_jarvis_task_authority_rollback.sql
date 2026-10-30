-- Removes the server-only JARVIS task authority functions and restores the browser's
-- earlier direct INSERT/UPDATE grant on jarvis_tasks. Existing tasks and activity stay.
BEGIN;

DROP FUNCTION IF EXISTS public.jarvis_revoke_device(uuid, uuid);
DROP FUNCTION IF EXISTS public.jarvis_task_state(uuid);
DROP FUNCTION IF EXISTS public.jarvis_device_key(uuid);
DROP FUNCTION IF EXISTS public.jarvis_settle_task(uuid, uuid, jsonb, text);
DROP FUNCTION IF EXISTS public.jarvis_stop_task(uuid, uuid);
DROP FUNCTION IF EXISTS public.jarvis_submit_receipt(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.jarvis_claim_action(uuid);
DROP FUNCTION IF EXISTS public.jarvis_queue_actions(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.jarvis_open_task(uuid, uuid, uuid, text, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.jarvis_device_seen(uuid, bigint);
DROP FUNCTION IF EXISTS public.jarvis_approve_device(uuid, text);
DROP FUNCTION IF EXISTS public.jarvis_enroll_device(text, text, text, text, text);
DROP FUNCTION IF EXISTS public.jarvis_device_code(text);
DROP FUNCTION IF EXISTS public.jarvis_allowed(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.jarvis_paused();
DROP INDEX IF EXISTS public.jarvis_activity_one_action_per_key;
GRANT INSERT, UPDATE ON public.jarvis_tasks TO authenticated;

COMMIT;
