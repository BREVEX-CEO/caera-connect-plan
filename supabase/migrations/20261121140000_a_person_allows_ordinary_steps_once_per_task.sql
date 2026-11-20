-- SMART APPROVALS (plan 27.2.2 R12-02, 27.1.3): a person who allows one ordinary in-app step can
-- allow "steps like this, in this app or on this site, for the rest of this task", so a 50-step
-- task is not 50 prompts. The scope is exact (operation + app or site), lives only as long as the
-- task, can be withdrawn at any time ("ask me again"), and is never available for consequential
-- effects: commands, long jobs, installing software, uploading or downloading files and external
-- tool writes are still confirmed one by one. A scope recorded for a step that is pre-approved
-- marks it confirmed, so every later check (and the timeline) sees who allowed it and when.
BEGIN;

CREATE TABLE public.jarvis_step_approvals (
  task_id uuid NOT NULL REFERENCES public.jarvis_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation text NOT NULL,
  target text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, operation, target)
);
CREATE INDEX jarvis_step_approvals_user_idx ON public.jarvis_step_approvals (user_id);
ALTER TABLE public.jarvis_step_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.jarvis_step_approvals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.jarvis_step_approvals TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.jarvis_step_approvals TO service_role;
CREATE POLICY jarvis_step_approvals_own ON public.jarvis_step_approvals FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY jarvis_step_approvals_service ON public.jarvis_step_approvals FOR ALL TO service_role USING (true);

-- Which ordinary in-app effects may be allowed for the rest of a task, and the exact scope key.
CREATE FUNCTION public.jarvis_approval_scope(p_action jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE
    WHEN p_action ->> 'operation' IN ('ui.invoke', 'ui.set_value', 'ui.send_keys', 'ui.click_point', 'apps.launch',
                                      'office.edit_document', 'office.edit_workbook')
         AND p_action -> 'target' ->> 'app' IS NOT NULL THEN 'app:' || (p_action -> 'target' ->> 'app')
    WHEN p_action ->> 'operation' IN ('web.fill', 'web.select', 'web.click')
         AND p_action -> 'target' ->> 'site' IS NOT NULL THEN 'site:' || (p_action -> 'target' ->> 'site')
    WHEN p_action ->> 'operation' IN ('office.edit_document', 'office.edit_workbook', 'fs.replace_text', 'fs.edit_text')
         THEN 'files'
  END;
$$;

CREATE FUNCTION public.jarvis_step_approved(p_task uuid, p_action jsonb)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  SELECT public.jarvis_approval_scope(p_action) IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.jarvis_step_approvals AS s
     WHERE s.task_id = p_task AND s.operation = p_action ->> 'operation'
       AND s.target = public.jarvis_approval_scope(p_action));
$$;

-- Allow one step; with p_scope, also every step like it in this task (only for scopable steps).
CREATE FUNCTION public.jarvis_confirm_action(p_user uuid, p_activity uuid, p_scope boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_row record;
  v_scope text;
BEGIN
  SELECT a.* INTO v_row FROM public.jarvis_activity AS a
   WHERE a.id = p_activity AND a.user_id = p_user AND a.status = 'needs_confirmation'
     AND EXISTS (SELECT 1 FROM public.jarvis_tasks AS t
                  WHERE t.id = a.task_id AND t.status = 'running' AND t.controller = a.controller)
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  v_scope := public.jarvis_approval_scope(v_row.action);
  IF p_scope AND v_scope IS NULL THEN
    RAISE EXCEPTION 'approval_not_scopable' USING ERRCODE = '42501';
  END IF;
  IF p_scope THEN
    INSERT INTO public.jarvis_step_approvals (task_id, user_id, operation, target)
    VALUES (v_row.task_id, p_user, v_row.action ->> 'operation', v_scope)
    ON CONFLICT DO NOTHING;
  END IF;
  UPDATE public.jarvis_activity AS a SET status = 'queued', confirmed = true, confirmed_at = statement_timestamp()
   WHERE a.task_id = v_row.task_id AND a.status = 'needs_confirmation' AND a.controller = v_row.controller
     AND (a.id = p_activity OR (p_scope AND a.action ->> 'operation' = v_row.action ->> 'operation'
                                AND public.jarvis_approval_scope(a.action) = v_scope));
  RETURN true;
END;
$$;

CREATE FUNCTION public.jarvis_task_approvals(p_task uuid)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  SELECT count(*)::integer FROM public.jarvis_step_approvals AS s WHERE s.task_id = p_task;
$$;

-- "Ask me again": the person withdraws every scope of one of their tasks.
CREATE FUNCTION public.jarvis_clear_approvals(p_user uuid, p_task uuid)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $$
  WITH gone AS (DELETE FROM public.jarvis_step_approvals AS s
                 WHERE s.task_id = p_task AND s.user_id = p_user RETURNING 1)
  SELECT count(*)::integer FROM gone;
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
    INSERT INTO public.jarvis_activity (user_id, task_id, device_id, summary, action, status, controller, created_at, lane, resources, confirmed, confirmed_at)
    VALUES (v_task.user_id, p_task, v_task.device_id, v_item ->> 'summary', v_item -> 'action',
            CASE WHEN v_item -> 'action' ->> 'risk' <> 'external_effect' THEN 'queued'
                 WHEN public.jarvis_step_approved(p_task, v_item -> 'action') THEN 'queued'
                 ELSE 'needs_confirmation' END,
            p_controller, clock_timestamp(), v_lane, v_resources,
            v_item -> 'action' ->> 'risk' = 'external_effect' AND public.jarvis_step_approved(p_task, v_item -> 'action'),
            CASE WHEN v_item -> 'action' ->> 'risk' = 'external_effect'
                      AND public.jarvis_step_approved(p_task, v_item -> 'action') THEN clock_timestamp() END)
    ON CONFLICT (task_id, (action ->> 'key')) WHERE action ? 'operation' DO NOTHING;
    IF FOUND THEN
      v_queued := v_queued + 1;
    END IF;
  END LOOP;
  UPDATE public.jarvis_tasks AS t SET updated_at = statement_timestamp() WHERE t.id = p_task;
  RETURN v_queued;
END;
$$;

REVOKE ALL ON FUNCTION public.jarvis_approval_scope(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jarvis_step_approved(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jarvis_confirm_action(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jarvis_clear_approvals(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jarvis_task_approvals(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_task_approvals(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.jarvis_approval_scope(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.jarvis_step_approved(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.jarvis_confirm_action(uuid, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.jarvis_clear_approvals(uuid, uuid) TO service_role;

COMMIT;
