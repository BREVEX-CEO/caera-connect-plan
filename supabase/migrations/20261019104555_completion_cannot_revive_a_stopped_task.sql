-- A stale planner cannot complete (and charge) a task after STOP, pause or takeover.
-- This check executes while the task row is locked by the completion UPDATE.
BEGIN;

CREATE FUNCTION public.jarvis_completion_requires_running()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status NOT IN ('running', 'completed') THEN
    RAISE EXCEPTION 'Only a running task can complete' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.jarvis_completion_requires_running() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER jarvis_completion_requires_running
BEFORE UPDATE OF status ON public.jarvis_tasks
FOR EACH ROW EXECUTE FUNCTION public.jarvis_completion_requires_running();

COMMIT;
