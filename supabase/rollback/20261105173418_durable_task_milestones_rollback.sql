-- C2 rollback: preserve task data while restoring the previous authority functions.
BEGIN;
DROP TRIGGER jarvis_task_plan_fixed ON public.jarvis_tasks;
DROP FUNCTION public.jarvis_task_plan_is_fixed();
DROP FUNCTION public.jarvis_complete_milestone(uuid, uuid, integer);
CREATE OR REPLACE FUNCTION public.jarvis_set_outcome(p_task uuid, p_controller uuid, p_outcome jsonb, p_plan jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_task record;
BEGIN
  SELECT t.* INTO v_task FROM public.jarvis_tasks AS t WHERE t.id = p_task FOR UPDATE;
  IF NOT FOUND OR v_task.status <> 'running' OR v_task.controller IS DISTINCT FROM p_controller THEN
    RAISE EXCEPTION 'stale_controller' USING ERRCODE = '42501';
  END IF;
  IF coalesce(jsonb_array_length(v_task.outcome), 0) > 0 THEN
    RAISE EXCEPTION 'outcome_fixed' USING ERRCODE = '55000';
  END IF;
  IF jsonb_typeof(p_outcome) IS DISTINCT FROM 'array' OR jsonb_array_length(p_outcome) NOT BETWEEN 1 AND 10
     OR jsonb_typeof(p_plan) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'invalid_outcome' USING ERRCODE = '22023';
  END IF;
  UPDATE public.jarvis_tasks AS t
     SET outcome = p_outcome, plan = p_plan, updated_at = statement_timestamp()
   WHERE t.id = p_task;
END;
$$;
CREATE OR REPLACE FUNCTION public.jarvis_queue_actions(p_task uuid, p_controller uuid, p_actions jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_task record;
  v_item jsonb;
  v_queued integer := 0;
BEGIN
  IF public.jarvis_paused() THEN
    RAISE EXCEPTION 'jarvis_paused' USING ERRCODE = '42501';
  END IF;
  SELECT t.* INTO v_task FROM public.jarvis_tasks AS t WHERE t.id = p_task FOR UPDATE;
  IF NOT FOUND OR v_task.status <> 'running' OR v_task.controller IS DISTINCT FROM p_controller THEN
    RAISE EXCEPTION 'stale_controller' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_actions) <> 'array' OR jsonb_array_length(p_actions) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'invalid_actions' USING ERRCODE = '22023';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_actions) LOOP
    -- Reads and reversible writes run; an external effect waits for the person; nothing else.
    IF v_item -> 'action' ->> 'risk' NOT IN ('read', 'reversible_write', 'external_effect') THEN
      RAISE EXCEPTION 'risk_not_supported' USING ERRCODE = '42501';
    END IF;
    -- Until the checks are fixed from what was observed, nothing may change anything.
    IF coalesce(jsonb_array_length(v_task.outcome), 0) = 0 AND v_item -> 'action' ->> 'risk' <> 'read' THEN
      RAISE EXCEPTION 'outcome_required' USING ERRCODE = '42501';
    END IF;
    IF NOT public.jarvis_action_allowed(v_task.user_id, v_task.device_id, v_item -> 'action') THEN
      RAISE EXCEPTION 'permission_required' USING ERRCODE = '42501';
    END IF;
    -- clock_timestamp: actions queued together keep their order (dispatch sorts by it).
    INSERT INTO public.jarvis_activity (user_id, task_id, device_id, summary, action, status, controller, created_at)
    VALUES (v_task.user_id, p_task, v_task.device_id, v_item ->> 'summary', v_item -> 'action',
            CASE WHEN v_item -> 'action' ->> 'risk' = 'external_effect' THEN 'needs_confirmation' ELSE 'queued' END,
            p_controller, clock_timestamp())
    ON CONFLICT (task_id, (action ->> 'key')) WHERE action ? 'operation' DO NOTHING;
    IF FOUND THEN
      v_queued := v_queued + 1;
    END IF;
  END LOOP;
  UPDATE public.jarvis_tasks AS t SET updated_at = statement_timestamp() WHERE t.id = p_task;
  RETURN v_queued;
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
CREATE OR REPLACE FUNCTION public.jarvis_settle_task(
  p_task uuid, p_controller uuid, p_verification jsonb, p_summary text
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_task record;
  v_expected text[];
  v_passed text[];
  v_actions integer;
BEGIN
  SELECT t.* INTO v_task FROM public.jarvis_tasks AS t WHERE t.id = p_task FOR UPDATE;
  IF NOT FOUND OR v_task.status <> 'running' OR v_task.controller IS DISTINCT FROM p_controller THEN
    RAISE EXCEPTION 'stale_controller' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.jarvis_activity AS a
              WHERE a.task_id = p_task AND a.status IN ('queued', 'claimed', 'needs_confirmation')) THEN
    RAISE EXCEPTION 'actions_open' USING ERRCODE = '55000';
  END IF;

  SELECT coalesce(array_agg(c ->> 'id' ORDER BY c ->> 'id'), '{}') INTO v_expected
    FROM jsonb_array_elements(coalesce(v_task.outcome, '[]'::jsonb)) AS c;
  SELECT coalesce(array_agg(DISTINCT p ORDER BY p), '{}') INTO v_passed
    FROM jsonb_array_elements_text(coalesce(p_verification -> 'passed', '[]'::jsonb)) AS p;
  SELECT count(*) INTO v_actions FROM public.jarvis_activity AS a
   WHERE a.task_id = p_task AND a.status <> 'note';

  IF cardinality(v_expected) > 0
     AND v_expected <@ v_passed
     AND jsonb_array_length(coalesce(p_verification -> 'failed', '[]'::jsonb)) = 0
     AND jsonb_array_length(coalesce(p_verification -> 'unverified', '[]'::jsonb)) = 0 THEN
    UPDATE public.jarvis_tasks AS t
       SET verified_actions = v_actions, status = 'completed', result = left(p_summary, 8000),
           controller = NULL, finished_at = statement_timestamp(), updated_at = statement_timestamp(),
           checkpoint = jsonb_build_object('phase', 'completed', 'verification', p_verification)
     WHERE t.id = p_task;
    PERFORM public.jarvis_tell(p_task, left(p_summary, 8000));
    RETURN 'completed';
  END IF;
  UPDATE public.jarvis_tasks AS t
     SET status = 'blocked', blocker = left(coalesce(p_summary, 'The result did not pass its checks.'), 300),
         controller = NULL, finished_at = statement_timestamp(), updated_at = statement_timestamp(),
         checkpoint = jsonb_build_object('phase', 'partial', 'verification', p_verification)
   WHERE t.id = p_task;
  PERFORM public.jarvis_tell(p_task, coalesce(p_summary, 'The result did not pass its checks.'));
  RETURN 'blocked';
END;
$$;
DROP FUNCTION public.jarvis_milestone_plan(jsonb, jsonb);
COMMIT;
