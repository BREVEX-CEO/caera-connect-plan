-- C2: model-selected milestones live inside the existing task authority.
-- Keep immutable acceptance, the controller/STOP fence, grant checks and the independent verifier.
BEGIN;

CREATE OR REPLACE FUNCTION public.jarvis_milestone_plan(p_outcome jsonb, p_plan jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_plan jsonb := p_plan;
  v_milestone jsonb;
BEGIN
  IF jsonb_typeof(p_outcome) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_outcome) NOT BETWEEN 1 AND 10
     OR jsonb_typeof(v_plan) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'invalid_milestone_plan' USING ERRCODE = '22023';
  END IF;
  -- Older callers supplied descriptions only; preserve them as one bounded phase.
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_plan) AS m WHERE jsonb_typeof(m) <> 'string') THEN
    v_plan := jsonb_build_array(jsonb_build_object(
      'description', coalesce(nullif(left(p_outcome -> 0 ->> 'description', 300), ''), 'Complete the requested result'),
      'checks', (SELECT jsonb_agg(c ->> 'id') FROM jsonb_array_elements(p_outcome) AS c),
      'stepBudget', 30));
  END IF;
  IF jsonb_array_length(v_plan) NOT BETWEEN 1 AND 6 THEN
    RAISE EXCEPTION 'invalid_milestone_plan' USING ERRCODE = '22023';
  END IF;
  FOR v_milestone IN SELECT value FROM jsonb_array_elements(v_plan) LOOP
    IF jsonb_typeof(v_milestone) IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_milestone -> 'description') IS DISTINCT FROM 'string'
       OR length(btrim(v_milestone ->> 'description')) NOT BETWEEN 1 AND 300
       OR jsonb_typeof(v_milestone -> 'checks') IS DISTINCT FROM 'array'
       OR jsonb_typeof(v_milestone -> 'stepBudget') IS DISTINCT FROM 'number'
       OR (v_milestone ->> 'stepBudget') !~ '^[0-9]{1,2}$' THEN
      RAISE EXCEPTION 'invalid_milestone_plan' USING ERRCODE = '22023';
    END IF;
    IF (v_milestone ->> 'stepBudget')::integer NOT BETWEEN 1 AND 30
       OR jsonb_array_length(v_milestone -> 'checks') NOT BETWEEN 1 AND 10
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(v_milestone) AS k
                   WHERE k NOT IN ('description', 'checks', 'stepBudget'))
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_milestone -> 'checks') AS c WHERE jsonb_typeof(c) <> 'string')
       OR (SELECT count(*) <> count(DISTINCT c) FROM jsonb_array_elements_text(v_milestone -> 'checks') AS c)
       OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_milestone -> 'checks') AS id
                   WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_outcome) AS c WHERE c ->> 'id' = id)) THEN
      RAISE EXCEPTION 'invalid_milestone_plan' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_outcome) AS c
              WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_plan) AS m
                                 WHERE (m -> 'checks') ? (c ->> 'id'))) THEN
    RAISE EXCEPTION 'invalid_milestone_plan' USING ERRCODE = '22023';
  END IF;
  RETURN v_plan;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_milestone_plan(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_milestone_plan(jsonb, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.jarvis_task_plan_is_fixed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
BEGIN
  IF OLD.outcome IS NOT NULL AND NEW.plan IS DISTINCT FROM OLD.plan THEN
    RAISE EXCEPTION 'milestone_plan_fixed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_task_plan_is_fixed() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER jarvis_task_plan_fixed BEFORE UPDATE OF plan ON public.jarvis_tasks
FOR EACH ROW EXECUTE FUNCTION public.jarvis_task_plan_is_fixed();

CREATE OR REPLACE FUNCTION public.jarvis_set_outcome(p_task uuid, p_controller uuid, p_outcome jsonb, p_plan jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_task record;
  v_plan jsonb;
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
  v_plan := public.jarvis_milestone_plan(p_outcome, p_plan);
  UPDATE public.jarvis_tasks AS t
     SET outcome = p_outcome, plan = v_plan,
         checkpoint = coalesce(t.checkpoint, '{}'::jsonb) || jsonb_build_object('milestones',
           jsonb_build_object('index', 0, 'startStep', 0, 'verified', '[]'::jsonb)),
         updated_at = statement_timestamp()
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

CREATE OR REPLACE FUNCTION public.jarvis_complete_milestone(p_task uuid, p_controller uuid, p_index integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_task record;
  v_last record;
  v_expected jsonb;
  v_cursor jsonb;
  v_count integer;
BEGIN
  IF public.jarvis_paused() THEN
    RAISE EXCEPTION 'jarvis_paused' USING ERRCODE = '42501';
  END IF;
  SELECT t.* INTO v_task FROM public.jarvis_tasks AS t WHERE t.id = p_task FOR UPDATE;
  IF NOT FOUND OR v_task.status <> 'running' OR v_task.controller IS DISTINCT FROM p_controller THEN
    RAISE EXCEPTION 'stale_controller' USING ERRCODE = '42501';
  END IF;
  v_cursor := v_task.checkpoint -> 'milestones';
  IF p_index IS NULL OR p_index < 0 OR p_index >= jsonb_array_length(v_task.plan)
     OR p_index IS DISTINCT FROM (v_cursor ->> 'index')::integer THEN
    RAISE EXCEPTION 'milestone_changed' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.jarvis_activity AS a
              WHERE a.task_id = p_task AND a.status IN ('queued', 'claimed', 'needs_confirmation')) THEN
    RAISE EXCEPTION 'actions_open' USING ERRCODE = '55000';
  END IF;
  -- Task first, then activity: the same lock order as STOP and receipt recording.
  SELECT a.* INTO v_last FROM public.jarvis_activity AS a
   WHERE a.task_id = p_task AND a.action IS NOT NULL
   ORDER BY a.created_at DESC, a.id DESC LIMIT 1 FOR UPDATE;
  SELECT coalesce(jsonb_agg(c ORDER BY n), '[]'::jsonb) INTO v_expected
    FROM jsonb_array_elements(v_task.outcome) WITH ORDINALITY AS check_row(c, n)
   WHERE (v_task.plan -> p_index -> 'checks') ? (c ->> 'id');
  IF v_last.id IS NULL OR v_last.status IS DISTINCT FROM 'done'
     OR v_last.controller IS DISTINCT FROM p_controller
     OR v_last.action ->> 'operation' IS DISTINCT FROM 'verify.checks'
     OR v_last.action #> '{arguments,checks}' IS DISTINCT FROM v_expected
     OR v_last.result ->> 'status' IS DISTINCT FROM 'observed'
     OR v_last.result ->> 'errorCode' IS NOT NULL
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_expected) AS c
                 WHERE v_last.result #> ARRAY['evidence', 'predicates', c ->> 'id'] IS DISTINCT FROM 'true'::jsonb)
     OR public.jarvis_action_allowed(v_task.user_id, v_task.device_id, v_last.action) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'milestone_unverified' USING ERRCODE = '42501';
  END IF;
  SELECT count(*) INTO v_count FROM public.jarvis_activity AS a
   WHERE a.task_id = p_task AND a.action IS NOT NULL;
  IF v_count <= (v_cursor ->> 'startStep')::integer THEN
    RAISE EXCEPTION 'milestone_unverified' USING ERRCODE = '42501';
  END IF;
  UPDATE public.jarvis_tasks AS t
     SET checkpoint = coalesce(t.checkpoint, '{}'::jsonb) || jsonb_build_object('milestones',
           jsonb_build_object('index', p_index + 1, 'startStep', v_count,
             'verified', coalesce(v_cursor -> 'verified', '[]'::jsonb) ||
               jsonb_build_array(jsonb_build_object('index', p_index, 'stepId', v_last.id,
                 'checks', v_task.plan -> p_index -> 'checks')))),
         updated_at = statement_timestamp()
   WHERE t.id = p_task;
  RETURN p_index + 1;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_complete_milestone(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_complete_milestone(uuid, uuid, integer) TO service_role;

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
    'plan', t.plan, 'checkpoint', t.checkpoint, 'conversationId', t.conversation_id,
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
                                          'confirmedAt', a.confirmed_at, 'claimedAt', a.claimed_at, 'controller', a.controller,
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
           checkpoint = coalesce(t.checkpoint, '{}'::jsonb) || jsonb_build_object('phase', 'completed', 'verification', p_verification)
     WHERE t.id = p_task;
    PERFORM public.jarvis_tell(p_task, left(p_summary, 8000));
    RETURN 'completed';
  END IF;
  UPDATE public.jarvis_tasks AS t
     SET status = 'blocked', blocker = left(coalesce(p_summary, 'The result did not pass its checks.'), 300),
         controller = NULL, finished_at = statement_timestamp(), updated_at = statement_timestamp(),
         checkpoint = coalesce(t.checkpoint, '{}'::jsonb) || jsonb_build_object('phase', 'partial', 'verification', p_verification)
   WHERE t.id = p_task;
  PERFORM public.jarvis_tell(p_task, coalesce(p_summary, 'The result did not pass its checks.'));
  RETURN 'blocked';
END;
$$;

COMMIT;
