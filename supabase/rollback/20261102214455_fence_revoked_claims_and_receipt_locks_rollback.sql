-- Rollback of 20261102214455_fence_revoked_claims_and_receipt_locks.sql: restores what it replaced and removes what it added.
-- Data in removed columns is lost; nothing else changes.
BEGIN;

-- public.jarvis_claim_action: the definition before this migration.
CREATE OR REPLACE FUNCTION public.jarvis_claim_action(p_device uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_device record;
  v_task record;
  v_action record;
BEGIN
  SELECT d.* INTO v_device FROM public.jarvis_devices AS d
   WHERE d.id = p_device AND d.user_id IS NOT NULL AND d.revoked_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'device_unavailable' USING ERRCODE = '42501';
  END IF;
  SELECT t.id, t.status, t.controller INTO v_task FROM public.jarvis_tasks AS t
   WHERE t.device_id = p_device AND t.user_id = v_device.user_id
     AND t.status IN ('running', 'waiting', 'taken_over')
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('task', NULL, 'action', NULL);
  END IF;
  IF v_task.status <> 'running' OR public.jarvis_paused() THEN
    RETURN jsonb_build_object('task', jsonb_build_object('id', v_task.id, 'status', v_task.status),
                              'action', NULL);
  END IF;

  SELECT a.id, a.action INTO v_action FROM public.jarvis_activity AS a
   WHERE a.task_id = v_task.id AND a.status = 'claimed'
   ORDER BY a.created_at LIMIT 1;
  IF NOT FOUND THEN
    SELECT a.id, a.action INTO v_action FROM public.jarvis_activity AS a
     WHERE a.task_id = v_task.id AND a.status = 'queued' AND a.controller = v_task.controller
     ORDER BY a.created_at, a.id LIMIT 1
     FOR UPDATE SKIP LOCKED;
    IF FOUND THEN
      -- Permission is rechecked at the moment of dispatch, not only when queued.
      IF NOT public.jarvis_action_allowed(v_device.user_id, p_device, v_action.action) THEN
        UPDATE public.jarvis_activity AS a
           SET status = 'blocked', completed_at = statement_timestamp(),
               result = jsonb_build_object('status', 'not_applied', 'errorCode', 'permission_revoked')
         WHERE a.id = v_action.id;
        UPDATE public.jarvis_tasks AS t
           SET status = 'blocked', blocker = 'A permission this task needs was turned off.',
               controller = NULL, finished_at = statement_timestamp(), updated_at = statement_timestamp()
         WHERE t.id = v_task.id;
        RETURN jsonb_build_object('task', jsonb_build_object('id', v_task.id, 'status', 'blocked'),
                                  'action', NULL);
      END IF;
      UPDATE public.jarvis_activity AS a SET status = 'claimed' WHERE a.id = v_action.id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'task', jsonb_build_object('id', v_task.id, 'status', v_task.status),
    'action', CASE WHEN v_action.id IS NULL THEN NULL
                   ELSE jsonb_build_object('id', v_action.id, 'intent', v_action.action) END
  );
END;
$$;

-- public.jarvis_submit_receipt: the definition before this migration.
CREATE OR REPLACE FUNCTION public.jarvis_submit_receipt(p_device uuid, p_activity uuid, p_receipt jsonb)
RETURNS TABLE (outcome text, task_id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_row record;
  v_status text;
BEGIN
  SELECT a.* INTO v_row FROM public.jarvis_activity AS a
   WHERE a.id = p_activity AND a.device_id = p_device
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_action' USING ERRCODE = 'P0002';
  END IF;
  v_status := CASE p_receipt ->> 'status'
    WHEN 'observed' THEN 'done'
    WHEN 'not_applied' THEN 'failed'
    WHEN 'unknown' THEN 'blocked'
  END;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'invalid_receipt' USING ERRCODE = '22023';
  END IF;

  IF v_row.status = 'claimed' THEN
    UPDATE public.jarvis_activity AS a
       SET status = v_status, result = p_receipt, completed_at = statement_timestamp()
     WHERE a.id = p_activity;
    IF v_status = 'blocked' THEN
      -- An effect that may have happened is reconciled before anything else is tried.
      UPDATE public.jarvis_tasks AS t
         SET status = 'waiting', blocker = 'OCADE is checking whether a step took effect.',
             paused_at = coalesce(t.paused_at, statement_timestamp()), updated_at = statement_timestamp()
       WHERE t.id = v_row.task_id AND t.status = 'running';
    ELSE
      UPDATE public.jarvis_tasks AS t SET updated_at = statement_timestamp() WHERE t.id = v_row.task_id;
    END IF;
    RETURN QUERY SELECT 'accepted'::text, v_row.task_id;
    RETURN;
  END IF;
  IF v_row.status = 'cancelled' AND v_row.result = '{"status": "unknown"}'::jsonb THEN
    UPDATE public.jarvis_activity AS a SET result = p_receipt WHERE a.id = p_activity;
    RETURN QUERY SELECT 'recorded_after_stop'::text, v_row.task_id;
    RETURN;
  END IF;
  IF v_row.result IS NOT DISTINCT FROM p_receipt THEN
    RETURN QUERY SELECT 'duplicate'::text, v_row.task_id;
    RETURN;
  END IF;
  RAISE EXCEPTION 'receipt_conflict' USING ERRCODE = '23505';
END;
$$;

COMMIT;
