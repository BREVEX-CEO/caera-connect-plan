-- An action is queued only while its task runs under the loop that queues it (PLAN Phase 02, V03).
--
-- queueTaskAction read the task (running, this loop's) and inserted the action afterwards. A STOP,
-- a takeover or another tab landing in between cancelled what was queued, and then the late
-- insert arrived: a queued step on a stopped task, or one from a loop that no longer owns it. Now
-- the insert itself checks, under a share lock on the task row that STOP, takeover and completion
-- must wait for (they update the row): the task is running, and jarvis_activity.controller — the
-- loop that queued it — is the task's controller. 20261016090000's completed-only guard is folded
-- in. Rows that are not waiting to run (notes, results, refusals) are not checked.
BEGIN;

ALTER TABLE public.jarvis_activity
  ADD COLUMN IF NOT EXISTS controller uuid;

CREATE OR REPLACE FUNCTION public.jarvis_no_action_after_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_task record;
BEGIN
  IF NEW.status NOT IN ('queued', 'claimed', 'needs_confirmation') OR NEW.task_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT t.status, t.controller INTO v_task
    FROM public.jarvis_tasks AS t WHERE t.id = NEW.task_id FOR SHARE;
  IF v_task.status = 'completed' THEN
    RAISE EXCEPTION 'That task is completed' USING ERRCODE = '42501';
  END IF;
  IF v_task.status IS DISTINCT FROM 'running' THEN
    RAISE EXCEPTION 'That task is not running' USING ERRCODE = '42501';
  END IF;
  IF NEW.controller IS DISTINCT FROM v_task.controller THEN
    RAISE EXCEPTION 'Another loop controls that task' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_no_action_after_completion() FROM PUBLIC, anon, authenticated;

COMMIT;
