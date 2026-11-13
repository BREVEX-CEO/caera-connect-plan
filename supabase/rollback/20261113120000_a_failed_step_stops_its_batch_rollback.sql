-- Rollback of 20261113120000_a_failed_step_stops_its_batch.sql: restores the receipt function
-- of 20261102214455 exactly (a failed step no longer cancels the steps queued behind it).
BEGIN;

CREATE OR REPLACE FUNCTION public.jarvis_submit_receipt(p_device uuid, p_activity uuid, p_receipt jsonb)
RETURNS TABLE (outcome text, task_id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_row record;
  v_status text;
  v_task uuid;
BEGIN
  -- Task before action: the same lock order as claim and STOP, so a receipt waits, never deadlocks.
  SELECT a.task_id INTO v_task FROM public.jarvis_activity AS a
   WHERE a.id = p_activity AND a.device_id = p_device;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_action' USING ERRCODE = 'P0002';
  END IF;
  PERFORM 1 FROM public.jarvis_tasks AS t WHERE t.id = v_task FOR UPDATE;
  SELECT a.* INTO v_row FROM public.jarvis_activity AS a
   WHERE a.id = p_activity AND a.device_id = p_device
   FOR UPDATE;
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
