-- Only OCADE's server records a task completed, and a step stopped after it
-- reached the computer is never mistaken for one that never ran (PLAN P01).
--
-- 1. The person's own client could update its task row to 'completed' directly,
--    skipping the server's check that the device read the result back. Now only
--    the server (service role) may set it; every other status stays the person's.
-- 2. An action cancelled while the device held it may already have acted. It now
--    keeps an 'unknown' outcome instead of none, so completion still asks for a
--    fresh read, and a late answer from the device is kept in full.
BEGIN;

CREATE OR REPLACE FUNCTION public.jarvis_task_completion_is_the_servers()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed')
     AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'Only OCADE records a task completed, after checking its result'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_task_completion_is_the_servers() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS jarvis_tasks_completion_is_the_servers ON public.jarvis_tasks;
CREATE TRIGGER jarvis_tasks_completion_is_the_servers
BEFORE INSERT OR UPDATE OF status ON public.jarvis_tasks
FOR EACH ROW EXECUTE FUNCTION public.jarvis_task_completion_is_the_servers();

CREATE OR REPLACE FUNCTION public.jarvis_activity_stopped_while_running()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF OLD.status = 'claimed' AND NEW.status IN ('cancelled', 'failed') AND NEW.result IS NULL THEN
    NEW.result := '{"status": "unknown"}'::jsonb;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_activity_stopped_while_running() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS jarvis_activity_stopped_while_running ON public.jarvis_activity;
CREATE TRIGGER jarvis_activity_stopped_while_running
BEFORE UPDATE OF status ON public.jarvis_activity
FOR EACH ROW EXECUTE FUNCTION public.jarvis_activity_stopped_while_running();

COMMIT;
