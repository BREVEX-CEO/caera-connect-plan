-- A task that waited only because the free online planner was busy resumes by itself once the
-- provider's retry time has passed (plan §23.11 "queue instead of failing", D10), instead of
-- waiting for the person. Any other change of state clears the retry time, so a task waiting
-- for a person, a permission or an uncertain step is never resumed automatically.
-- No applied migration is edited.
BEGIN;

ALTER TABLE public.jarvis_tasks ADD COLUMN IF NOT EXISTS retry_at timestamptz;

CREATE OR REPLACE FUNCTION public.jarvis_retry_only_while_busy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.retry_at IS NOT DISTINCT FROM OLD.retry_at THEN
    NEW.retry_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER jarvis_retry_only_while_busy
  BEFORE UPDATE ON public.jarvis_tasks
  FOR EACH ROW EXECUTE FUNCTION public.jarvis_retry_only_while_busy();

-- The planner was busy: wait, and say when trying again is worthwhile.
CREATE OR REPLACE FUNCTION public.jarvis_task_wait_until(p_task uuid, p_controller uuid, p_reason text,
                                                         p_retry_at timestamptz)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $$
  UPDATE public.jarvis_tasks AS t
     SET status = 'waiting', blocker = left(p_reason, 300), retry_at = p_retry_at,
         paused_at = coalesce(t.paused_at, statement_timestamp()), updated_at = statement_timestamp()
   WHERE t.id = p_task AND t.status = 'running' AND t.controller = p_controller;
$$;

-- When the device asks for work: its task that waited for the planner and is now due runs again.
CREATE OR REPLACE FUNCTION public.jarvis_resume_due(p_device uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_task record;
BEGIN
  SELECT t.id, t.user_id INTO v_task FROM public.jarvis_tasks AS t
   WHERE t.device_id = p_device AND t.status = 'waiting' AND t.retry_at <= statement_timestamp()
   FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  PERFORM public.jarvis_resume_task(v_task.user_id, v_task.id);
  RETURN v_task.id;
END;
$$;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.jarvis_task_wait_until(uuid, uuid, text, timestamptz)',
    'public.jarvis_resume_due(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_retry_only_while_busy() FROM PUBLIC, anon, authenticated;

COMMIT;
