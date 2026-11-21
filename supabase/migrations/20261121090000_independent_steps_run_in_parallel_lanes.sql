-- PARALLEL LANES (plan 14F.1.1, 14F.3; O-07): the steps of one planning turn that touch disjoint
-- resources run at the same time on separate companion workers.
--
-- Each step carries a lane (0..3) and the resources it reads or writes, derived HERE from the
-- operation and its arguments (never taken from the caller): workspace paths (`fs:/a/b`), the
-- OCADE browser (`web`), the person's desktop input (`desktop`, lane 0 only: one mouse and one
-- keyboard), or `*` for a step whose effects cannot be bounded. Queueing refuses a step whose
-- resources overlap a pending step in another lane (a path overlaps itself, its ancestors and its
-- descendants). The claim hands out, per lane, the held step or the lane's next queued step, so
-- several steps run at once while each lane keeps its order. STOP, Take Over, a lost permission and
-- a failed or uncertain step still cancel everything queued in every lane (unchanged functions).
--
-- BACKGROUND APP CONTROL (plan 14F.2.2, REPO-27, owner-approved 20 Nov 2026): a new permission,
-- `background`, off by default. With it on, the claim tells the companion so, and app controls
-- driven through accessibility patterns (invoke, set value, scroll: no pointer, no keyboard, no
-- focus change) may run while the person keeps using their computer. Typing and clicking still
-- wait until the person is idle, as before; STOP and Take Over are unchanged.
BEGIN;

ALTER TABLE public.jarvis_permissions DROP CONSTRAINT IF EXISTS jarvis_permissions_capability_check;
ALTER TABLE public.jarvis_permissions ADD CONSTRAINT jarvis_permissions_capability_check CHECK (
  capability IN ('master', 'memory', 'autonomous', 'browser', 'browser_real', 'files', 'screen',
                 'microphone', 'camera', 'apps', 'messaging', 'devices', 'computer_control',
                 'terminal', 'cowork', 'mcp', 'background')
  OR capability ~ '^site:[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$'
  OR (capability ~ '^app:[^[:cntrl:]]{1,80}$' AND capability !~ '[‎‏‪-‮⁦-⁩]')
  OR capability ~ '^mcp:[a-z][a-z0-9_]{1,30}$'
);

ALTER TABLE public.jarvis_activity
  ADD COLUMN IF NOT EXISTS lane smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resources text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.jarvis_activity DROP CONSTRAINT IF EXISTS jarvis_activity_lane_check;
ALTER TABLE public.jarvis_activity ADD CONSTRAINT jarvis_activity_lane_check
  CHECK (lane >= 0 AND lane <= 3 AND cardinality(resources) <= 8);
CREATE INDEX IF NOT EXISTS jarvis_activity_lane_idx
  ON public.jarvis_activity (task_id, lane, status, created_at);

CREATE OR REPLACE FUNCTION public.jarvis_workspace_key(p_path text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT 'fs:/' || coalesce((SELECT string_agg(lower(part), '/' ORDER BY n)
                               FROM unnest(string_to_array(replace(p_path, E'\\', '/'), '/'))
                                    WITH ORDINALITY AS u(part, n)
                              WHERE part NOT IN ('', '.')), '');
$$;

CREATE OR REPLACE FUNCTION public.jarvis_step_resources(p_action jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE
    WHEN op LIKE 'ui.%' OR op = 'apps.launch' THEN ARRAY['desktop']
    WHEN op LIKE 'web.%' THEN ARRAY['web']
    WHEN op IN ('system.inspect', 'apps.list', 'system.dependency', 'verify.dependency') THEN '{}'::text[]
    WHEN keys IS NULL THEN ARRAY['*']
    ELSE coalesce((SELECT array_agg(public.jarvis_workspace_key(p_action -> 'arguments' ->> k) ORDER BY k)
                     FROM unnest(keys) AS k
                    WHERE jsonb_typeof(p_action -> 'arguments' -> k) = 'string'), '{}'::text[])
  END
  FROM (SELECT p_action ->> 'operation' AS op,
               CASE p_action ->> 'operation'
                 WHEN 'fs.list' THEN ARRAY['path'] WHEN 'fs.read_text' THEN ARRAY['path']
                 WHEN 'fs.write_text' THEN ARRAY['path'] WHEN 'fs.manage' THEN ARRAY['path', 'to']
                 WHEN 'office.inspect_workbook' THEN ARRAY['path'] WHEN 'office.write_workbook' THEN ARRAY['path']
                 WHEN 'office.write_presentation' THEN ARRAY['path']
                 WHEN 'office.write_document' THEN ARRAY['docx', 'pdf']
                 WHEN 'image.edit' THEN ARRAY['source', 'output'] WHEN 'media.inspect' THEN ARRAY['path']
                 WHEN 'media.preview' THEN ARRAY['path'] WHEN 'media.analyze' THEN ARRAY['path']
                 WHEN 'media.trim' THEN ARRAY['source', 'output']
               END AS keys) AS spec;
$$;

CREATE OR REPLACE FUNCTION public.jarvis_resources_conflict(p_a text[], p_b text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM unnest(p_a) AS x, unnest(p_b) AS y
     WHERE x = '*' OR y = '*' OR x = y
        OR (x LIKE 'fs:%' AND starts_with(y, x || '/'))
        OR (y LIKE 'fs:%' AND starts_with(x, y || '/'))
        OR (x = 'fs:/' AND y LIKE 'fs:%') OR (y = 'fs:/' AND x LIKE 'fs:%'));
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
  v_pending integer;
  v_index integer;
  v_start integer;
  v_used integer;
  v_budget integer;
  v_decisions integer;
  v_job text;
  v_job_timeout integer;
  v_poll_count integer;
  v_lane smallint;
  v_resources text[];
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
    -- A task that names its apps (@app in its objective) acts only on those (P5).
    IF NOT public.jarvis_app_in_scope(v_task.user_id, v_task.device_id, v_task.title,
                                      v_item #>> '{action,target,app}') THEN
      RAISE EXCEPTION 'app_out_of_scope' USING ERRCODE = '42501';
    END IF;
    -- Parallel lanes (plan 14F.3): the server checks, never trusts, the planner's split.
    IF coalesce(v_item ->> 'lane', '0') !~ '^[0-3]$' THEN
      RAISE EXCEPTION 'invalid_lane' USING ERRCODE = '22023';
    END IF;
    v_lane := coalesce(v_item ->> 'lane', '0')::smallint;
    v_resources := public.jarvis_step_resources(v_item -> 'action');
    -- One mouse and keyboard: desktop input only ever runs in lane 0.
    IF 'desktop' = ANY (v_resources) AND v_lane <> 0 THEN
      RAISE EXCEPTION 'desktop_lane' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (SELECT 1 FROM public.jarvis_activity AS o
                WHERE o.task_id = p_task AND o.lane <> v_lane
                  AND o.status IN ('queued', 'claimed', 'needs_confirmation')
                  AND public.jarvis_resources_conflict(o.resources, v_resources)) THEN
      RAISE EXCEPTION 'lane_conflict' USING ERRCODE = '42501';
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
    INSERT INTO public.jarvis_activity (user_id, task_id, device_id, summary, action, status, controller, created_at, lane, resources)
    VALUES (v_task.user_id, p_task, v_task.device_id, v_item ->> 'summary', v_item -> 'action',
            CASE WHEN v_item -> 'action' ->> 'risk' = 'external_effect' THEN 'needs_confirmation' ELSE 'queued' END,
            p_controller, clock_timestamp(), v_lane, v_resources)
    ON CONFLICT (task_id, (action ->> 'key')) WHERE action ? 'operation' DO NOTHING;
    IF FOUND THEN
      v_queued := v_queued + 1;
    END IF;
  END LOOP;
  UPDATE public.jarvis_tasks AS t SET updated_at = statement_timestamp() WHERE t.id = p_task;
  RETURN v_queued;
END;
$$;

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
  v_paused boolean;
  v_jobs_allowed boolean;
  v_lane smallint;
  v_actions jsonb := '[]'::jsonb;
  v_held jsonb;
  v_background boolean;
BEGIN
  SELECT d.* INTO v_device FROM public.jarvis_devices AS d
   WHERE d.id = p_device AND d.user_id IS NOT NULL AND d.revoked_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'device_unavailable' USING ERRCODE = '42501';
  END IF;
  v_paused := public.jarvis_paused();
  v_jobs_allowed := NOT v_paused AND public.jarvis_allowed(v_device.user_id, p_device, 'computer_control');
  v_background := coalesce(public.jarvis_allowed(v_device.user_id, p_device, 'background'), false);
  SELECT t.id, t.status, t.controller, (t.checkpoint ->> 'authorizedSessionId')::uuid AS authorized_session_id INTO v_task FROM public.jarvis_tasks AS t
   WHERE t.device_id = p_device AND t.user_id = v_device.user_id
     AND t.status IN ('running', 'waiting', 'taken_over')
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('task', NULL, 'action', NULL, 'actions', '[]'::jsonb,
                              'paused', v_paused, 'jobsAllowed', v_jobs_allowed);
  END IF;
  IF v_task.authorized_session_id IS NOT NULL
     AND NOT public.ocade_session_is_live(v_device.user_id, v_task.authorized_session_id) THEN
    PERFORM public.jarvis_stop_task(v_device.user_id, v_task.id);
    RETURN jsonb_build_object('task', jsonb_build_object('id', v_task.id, 'status', 'stopped'),
                              'action', NULL, 'actions', '[]'::jsonb, 'paused', v_paused, 'jobsAllowed', false);
  END IF;
  -- Steps already running in other lanes keep running while one lane's uncertain step is checked
  -- (the task waits): they were authorized and touch nothing that step touches.
  SELECT coalesce(jsonb_agg(a.id ORDER BY a.lane), '[]'::jsonb) INTO v_held FROM public.jarvis_activity AS a
   WHERE a.task_id = v_task.id AND a.status = 'claimed';
  IF v_task.status <> 'running' OR v_paused THEN
    RETURN jsonb_build_object('task', jsonb_build_object('id', v_task.id, 'status', v_task.status),
                              'action', NULL, 'actions', '[]'::jsonb,
                              'running', CASE WHEN v_task.status = 'waiting' AND NOT v_paused THEN v_held ELSE '[]'::jsonb END,
                              'paused', v_paused, 'jobsAllowed', v_jobs_allowed);
  END IF;

  -- A held action that lost its permission is never handed out again. The device may already be
  -- running it, so it is cancelled with an unknown effect (trigger) and the task waits for
  -- reconciliation under no controller; nothing queued behind it can start.
  SELECT a.id INTO v_action FROM public.jarvis_activity AS a
   WHERE a.task_id = v_task.id AND a.status = 'claimed'
     AND NOT public.jarvis_action_allowed(v_device.user_id, p_device, a.action)
   ORDER BY a.created_at LIMIT 1;
  IF FOUND THEN
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
                              'action', NULL, 'actions', '[]'::jsonb, 'paused', v_paused, 'jobsAllowed', v_jobs_allowed);
  END IF;

  -- Each lane runs its own steps in order, at the same time as the other lanes (plan 14F.3).
  FOR v_lane IN 0..3 LOOP
    SELECT a.id, a.action INTO v_action FROM public.jarvis_activity AS a
     WHERE a.task_id = v_task.id AND a.status = 'claimed' AND a.lane = v_lane
     ORDER BY a.created_at LIMIT 1;
    IF NOT FOUND THEN
      SELECT a.id, a.action INTO v_action FROM public.jarvis_activity AS a
       WHERE a.task_id = v_task.id AND a.status = 'queued' AND a.controller = v_task.controller
         AND a.lane = v_lane
         -- A step the person must still confirm holds back the steps behind it in its lane.
         AND NOT EXISTS (SELECT 1 FROM public.jarvis_activity AS e
                          WHERE e.task_id = v_task.id AND e.lane = v_lane AND e.status = 'needs_confirmation'
                            AND (e.created_at, e.id) < (a.created_at, a.id))
       ORDER BY a.created_at, a.id LIMIT 1
       FOR UPDATE SKIP LOCKED;
      IF FOUND THEN
        -- Permission is rechecked at the moment of dispatch, not only when queued.
        IF NOT public.jarvis_action_allowed(v_device.user_id, p_device, v_action.action) THEN
          UPDATE public.jarvis_activity AS a
             SET status = 'blocked', completed_at = statement_timestamp(),
                 result = jsonb_build_object('status', 'not_applied', 'errorCode', 'permission_revoked')
           WHERE a.id = v_action.id;
          UPDATE public.jarvis_activity AS a
             SET status = 'cancelled', completed_at = statement_timestamp(),
                 result = jsonb_build_object('status', 'not_applied', 'maybeChanged', false,
                                             'errorCode', 'permission_revoked')
           WHERE a.task_id = v_task.id AND a.status IN ('queued', 'needs_confirmation');
          UPDATE public.jarvis_tasks AS t
             SET status = 'blocked', blocker = 'A permission this task needs was turned off.',
                 controller = NULL, finished_at = statement_timestamp(), updated_at = statement_timestamp()
           WHERE t.id = v_task.id;
          RETURN jsonb_build_object('task', jsonb_build_object('id', v_task.id, 'status', 'blocked'),
                                    'action', NULL, 'actions', '[]'::jsonb, 'paused', v_paused, 'jobsAllowed', v_jobs_allowed);
        END IF;
        UPDATE public.jarvis_activity AS a SET status = 'claimed', claimed_at = statement_timestamp()
         WHERE a.id = v_action.id;
      END IF;
    END IF;
    IF FOUND THEN
      v_actions := v_actions || jsonb_build_array(
        jsonb_build_object('id', v_action.id, 'intent', v_action.action, 'lane', v_lane));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'task', jsonb_build_object('id', v_task.id, 'status', v_task.status),
    'paused', v_paused, 'jobsAllowed', v_jobs_allowed, 'backgroundAllowed', v_background,
    -- `action` is lane 0 first: a companion that runs one step at a time still runs them all.
    'action', CASE WHEN jsonb_array_length(v_actions) = 0 THEN NULL
                   ELSE jsonb_build_object('id', v_actions -> 0 -> 'id', 'intent', v_actions -> 0 -> 'intent') END,
    'actions', v_actions
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
    'plan', t.plan, 'checkpoint', t.checkpoint - 'authorizedSessionId', 'conversationId', t.conversation_id,
    'sessionLive', t.checkpoint ->> 'authorizedSessionId' IS NULL
      OR public.ocade_session_is_live(t.user_id, (t.checkpoint ->> 'authorizedSessionId')::uuid),
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
      'modelCalls', t.model_calls, 'modelMs', t.model_ms,
      'plannerAutoRetries', t.planner_auto_retries,
      'providerUsage', jsonb_build_object(
        'inputTokens', CASE WHEN t.provider_input_calls > 0 THEN t.provider_input_tokens END,
        'outputTokens', CASE WHEN t.provider_output_calls > 0 THEN t.provider_output_tokens END,
        'inputMeasuredCalls', t.provider_input_calls, 'outputMeasuredCalls', t.provider_output_calls,
        'goalMs', t.planner_goal_ms, 'decisionMs', t.planner_decision_ms,
        'limitReached', cardinality(t.model_metric_ids) >= 512
      )),
    'steps', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', a.id, 'summary', a.summary, 'intent', a.action,
                                          'status', a.status, 'receipt', a.result,
                                          'createdAt', a.created_at, 'completedAt', a.completed_at,
                                          'confirmedAt', a.confirmed_at, 'claimedAt', a.claimed_at, 'controller', a.controller,
                                          'resolution', a.resolution, 'resolvedAt', a.resolved_at,
                                          'lane', a.lane)
                       ORDER BY a.created_at, a.id)
        FROM public.jarvis_activity AS a WHERE a.task_id = t.id AND a.action IS NOT NULL), '[]'::jsonb))
  FROM public.jarvis_tasks AS t WHERE t.id = p_task;
$$;

REVOKE ALL ON FUNCTION public.jarvis_workspace_key(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jarvis_step_resources(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jarvis_resources_conflict(text[], text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_workspace_key(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.jarvis_step_resources(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.jarvis_resources_conflict(text[], text[]) TO service_role;

COMMIT;
