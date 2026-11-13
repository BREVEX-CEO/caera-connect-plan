-- Rollback of 20261113130000_a_task_acts_only_on_the_apps_it_names.sql: restores the queue
-- function of 20261106184035 exactly and removes the scope function.
BEGIN;

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
  v_pending integer;
  v_index integer;
  v_start integer;
  v_used integer;
  v_budget integer;
  v_decisions integer;
  v_job text;
  v_job_timeout integer;
  v_poll_count integer;
BEGIN
  IF public.jarvis_paused() THEN
    RAISE EXCEPTION 'jarvis_paused' USING ERRCODE = '42501';
  END IF;
  SELECT t.* INTO v_task FROM public.jarvis_tasks AS t WHERE t.id = p_task FOR UPDATE;
  IF NOT FOUND OR v_task.status <> 'running' OR v_task.controller IS DISTINCT FROM p_controller THEN
    RAISE EXCEPTION 'stale_controller' USING ERRCODE = '42501';
  END IF;
  IF v_task.checkpoint ->> 'authorizedSessionId' IS NOT NULL
     AND NOT public.ocade_session_is_live(v_task.user_id, (v_task.checkpoint ->> 'authorizedSessionId')::uuid) THEN
    PERFORM public.jarvis_stop_task(v_task.user_id, p_task);
    RETURN 0;
  END IF;
  IF jsonb_typeof(p_actions) <> 'array' OR jsonb_array_length(p_actions) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'invalid_actions' USING ERRCODE = '22023';
  END IF;
  IF coalesce(jsonb_array_length(v_task.outcome), 0) > 0 THEN
    v_index := coalesce((v_task.checkpoint #>> '{milestones,index}')::integer, 0);
    v_start := coalesce((v_task.checkpoint #>> '{milestones,startStep}')::integer, 0);
    v_budget := coalesce((v_task.plan -> v_index ->> 'stepBudget')::integer, 30);
    SELECT count(*) INTO v_used FROM public.jarvis_activity AS a
     WHERE a.task_id = p_task AND a.action IS NOT NULL;
    IF v_start < 0 OR v_start > v_used OR v_index < 0 OR v_index > jsonb_array_length(v_task.plan) THEN
      RAISE EXCEPTION 'invalid_milestone_cursor' USING ERRCODE = '22023';
    END IF;
    SELECT count(*) INTO v_decisions
      FROM (SELECT a.action FROM public.jarvis_activity AS a
             WHERE a.task_id = p_task AND a.action IS NOT NULL
             ORDER BY a.created_at, a.id OFFSET v_start) AS phase_actions
     WHERE NOT (action ->> 'operation' = 'job.status' AND action ->> 'key' LIKE 'job-poll:%');
  END IF;
  SELECT count(*) INTO v_pending FROM public.jarvis_activity AS a
   WHERE a.task_id = p_task AND a.status IN ('queued', 'claimed', 'needs_confirmation');
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_actions) LOOP
    IF jsonb_array_length(v_task.plan) > 1 AND v_task.checkpoint ? 'milestones'
       AND v_item ->> 'milestone' IS DISTINCT FROM v_index::text THEN
      RAISE EXCEPTION 'milestone_changed' USING ERRCODE = '42501';
    END IF;
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
    IF EXISTS (SELECT 1 FROM public.jarvis_activity AS a WHERE a.task_id = p_task
                 AND a.action ->> 'key' = v_item #>> '{action,key}') THEN
      CONTINUE; -- duplicate turn: do not spend budget a second time
    END IF;
    IF v_pending + v_queued >= 10 THEN
      RAISE EXCEPTION 'queue_full' USING ERRCODE = '55P03';
    END IF;
    IF v_item #>> '{action,key}' LIKE 'job-poll:%' THEN
      -- Reserved observations can only follow a confirmed, observed start in this task.
      v_job := v_item #>> '{action,arguments,jobId}';
      IF v_index IS NULL OR jsonb_array_length(p_actions) <> 1
         OR v_job IS NULL OR v_job !~ '^[0-9a-f]{16}$'
         OR v_item #>> '{action,key}' IS DISTINCT FROM ('job-poll:' || v_job || ':' || (v_used + 1)::text)
         OR v_item #>> '{action,operation}' IS DISTINCT FROM 'job.status'
         OR v_item #>> '{action,capability}' IS DISTINCT FROM 'computer_control'
         OR v_item #>> '{action,risk}' IS DISTINCT FROM 'read' THEN
        RAISE EXCEPTION 'invalid_job_poll' USING ERRCODE = '42501';
      END IF;
      SELECT coalesce((a.action #>> '{arguments,timeoutSeconds}')::integer, 3600)
        INTO v_job_timeout FROM public.jarvis_activity AS a
       WHERE a.task_id = p_task AND a.status = 'done' AND a.confirmed_at IS NOT NULL
         AND a.action ->> 'operation' = 'job.start'
         AND a.result ->> 'status' = 'observed'
         AND a.result #>> '{evidence,state}' = 'running'
         AND a.result #>> '{evidence,jobId}' = v_job
       ORDER BY a.created_at DESC, a.id DESC LIMIT 1;
      IF v_job_timeout IS NULL OR v_job_timeout NOT BETWEEN 10 AND 21600 THEN
        RAISE EXCEPTION 'invalid_job_poll' USING ERRCODE = '42501';
      END IF;
      SELECT count(*) INTO v_poll_count FROM public.jarvis_activity AS a
       WHERE a.task_id = p_task AND a.action ->> 'key' LIKE ('job-poll:' || v_job || ':%');
      IF v_poll_count >= ceil(v_job_timeout / 30.0) + 12 THEN
        RAISE EXCEPTION 'job_poll_budget_exhausted' USING ERRCODE = '55000';
      END IF;
    ELSIF v_index IS NOT NULL THEN
      v_decisions := v_decisions + 1;
      IF v_decisions > v_budget THEN
        RAISE EXCEPTION 'milestone_budget_exhausted' USING ERRCODE = '55000';
      END IF;
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

DROP FUNCTION IF EXISTS public.jarvis_app_in_scope(uuid, uuid, text, text);

COMMIT;
