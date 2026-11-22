-- R12-02: browser/native input can cause an external effect even if a control looks harmless.
-- Keep repeat approval for backed-up, compare-and-swap edits to one exact workspace file.
BEGIN;

-- Withdraw the superseded grants. An already-dispatched action is left for reconciliation.
UPDATE public.jarvis_activity AS a
   SET status = 'needs_confirmation', confirmed = false, confirmed_at = NULL
  FROM public.jarvis_step_approvals AS s
 WHERE a.task_id = s.task_id AND a.status = 'queued' AND a.confirmed
   AND a.action ->> 'operation' = s.operation
   AND public.jarvis_approval_scope(a.action) = s.target;

DELETE FROM public.jarvis_step_approvals;

CREATE OR REPLACE FUNCTION public.jarvis_approval_scope(p_action jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE
    WHEN p_action ->> 'operation' IN ('office.edit_document', 'fs.replace_text', 'fs.edit_text')
         AND p_action #>> '{arguments,expectSha256}' ~ '^[0-9a-f]{64}$'
         AND nullif(p_action #>> '{arguments,path}', '') IS NOT NULL
      THEN 'path:' || (p_action #>> '{arguments,path}')
  END;
$$;

CREATE OR REPLACE FUNCTION public.jarvis_clear_approvals(p_user uuid, p_task uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_removed integer;
BEGIN
  -- Claim and queue take this same lock, so queued work cannot race past withdrawal.
  PERFORM 1 FROM public.jarvis_tasks AS t
   WHERE t.id = p_task AND t.user_id = p_user
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  UPDATE public.jarvis_activity AS a
     SET status = 'needs_confirmation', confirmed = false, confirmed_at = NULL
    FROM public.jarvis_step_approvals AS s
   WHERE a.task_id = p_task AND a.user_id = p_user AND a.status = 'queued' AND a.confirmed
     AND s.task_id = a.task_id AND s.user_id = a.user_id
     AND a.action ->> 'operation' = s.operation
     AND public.jarvis_approval_scope(a.action) = s.target;

  DELETE FROM public.jarvis_step_approvals AS s
   WHERE s.task_id = p_task AND s.user_id = p_user;
  GET DIAGNOSTICS v_removed = ROW_COUNT;
  RETURN v_removed;
END;
$$;

COMMIT;
