-- When the device picked each step up, so pickup delay is measured instead of lumped into
-- unaccounted time (plan W2). No applied migration is edited.
BEGIN;

ALTER TABLE public.jarvis_activity ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

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
  IF FOUND AND NOT public.jarvis_action_allowed(v_device.user_id, p_device, v_action.action) THEN
    -- A held action lost its permission: never hand it out again. The device may already be
    -- running it, so it is cancelled with an unknown effect (trigger) and the task waits for
    -- reconciliation under no controller; nothing queued behind it can start.
    UPDATE public.jarvis_activity AS a
       SET status = 'cancelled', completed_at = statement_timestamp()
     WHERE a.id = v_action.id;
    UPDATE public.jarvis_activity AS a
       SET status = 'cancelled', completed_at = statement_timestamp(),
           result = jsonb_build_object('status', 'not_applied', 'maybeChanged', false,
                                       'errorCode', 'permission_revoked')
     WHERE a.task_id = v_task.id AND a.status IN ('queued', 'needs_confirmation');
    UPDATE public.jarvis_tasks AS t
       SET status = 'waiting', controller = NULL,
           blocker = 'A permission was turned off while a step was running. OCADE is checking whether it took effect.',
           paused_at = coalesce(t.paused_at, statement_timestamp()), updated_at = statement_timestamp()
     WHERE t.id = v_task.id;
    RETURN jsonb_build_object('task', jsonb_build_object('id', v_task.id, 'status', 'waiting'),
                              'action', NULL);
  END IF;
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
      UPDATE public.jarvis_activity AS a SET status = 'claimed', claimed_at = statement_timestamp()
       WHERE a.id = v_action.id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'task', jsonb_build_object('id', v_task.id, 'status', v_task.status),
    'action', CASE WHEN v_action.id IS NULL THEN NULL
                   ELSE jsonb_build_object('id', v_action.id, 'intent', v_action.action) END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.jarvis_task_state(p_task uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT jsonb_build_object(
    'id', t.id, 'userId', t.user_id, 'status', t.status, 'controller', t.controller,
    'title', t.title, 'outcome', t.outcome, 'blocker', t.blocker, 'result', t.result,
    'checkpoint', t.checkpoint, 'conversationId', t.conversation_id,
    'deviceName', (SELECT d.name FROM public.jarvis_devices AS d WHERE d.id = t.device_id),
    'deviceSeenAt', (SELECT d.last_seen_at FROM public.jarvis_devices AS d WHERE d.id = t.device_id),
    'apps', (SELECT d.installed_apps FROM public.jarvis_devices AS d WHERE d.id = t.device_id),
    'mcp', (SELECT coalesce(d.capabilities -> 'mcp', '[]'::jsonb) FROM public.jarvis_devices AS d WHERE d.id = t.device_id),
    'engines', (SELECT d.capabilities -> 'engines' FROM public.jarvis_devices AS d WHERE d.id = t.device_id),
    'grants', public.jarvis_grants(t.user_id, t.device_id),
    'timing', jsonb_build_object(
      'acceptedAt', t.created_at, 'finishedAt', t.finished_at, 'now', statement_timestamp(),
      'pausedMs', t.user_wait_ms
        + coalesce((extract(epoch FROM coalesce(t.finished_at, statement_timestamp()) - t.paused_at) * 1000)::bigint, 0),
      'modelCalls', t.model_calls, 'modelMs', t.model_ms),
    'steps', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', a.id, 'summary', a.summary, 'intent', a.action,
                                          'status', a.status, 'receipt', a.result,
                                          'createdAt', a.created_at, 'completedAt', a.completed_at,
                                          'confirmedAt', a.confirmed_at, 'claimedAt', a.claimed_at,
                                          'resolution', a.resolution, 'resolvedAt', a.resolved_at)
                       ORDER BY a.created_at, a.id)
        FROM public.jarvis_activity AS a WHERE a.task_id = t.id AND a.action IS NOT NULL), '[]'::jsonb))
  FROM public.jarvis_tasks AS t WHERE t.id = p_task;
$$;

COMMIT;
