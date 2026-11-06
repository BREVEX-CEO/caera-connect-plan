-- Extend the existing authority with bounded, idempotent planning measurements.
BEGIN;

ALTER TABLE public.jarvis_tasks
  ADD COLUMN model_metric_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN provider_input_tokens bigint NOT NULL DEFAULT 0,
  ADD COLUMN provider_output_tokens bigint NOT NULL DEFAULT 0,
  ADD COLUMN provider_input_calls integer NOT NULL DEFAULT 0,
  ADD COLUMN provider_output_calls integer NOT NULL DEFAULT 0,
  ADD COLUMN planner_goal_ms bigint NOT NULL DEFAULT 0,
  ADD COLUMN planner_decision_ms bigint NOT NULL DEFAULT 0,
  ADD COLUMN planner_auto_retries integer NOT NULL DEFAULT 0;

CREATE FUNCTION public.jarvis_note_model_metrics(p_task uuid, p_phase text, p_samples jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_ids text[];
  v_sample jsonb;
  v_call text;
  v_ms integer;
  v_input integer;
  v_output integer;
  v_elapsed bigint := 0;
  v_calls integer := 0;
  v_input_total bigint := 0;
  v_output_total bigint := 0;
  v_input_calls integer := 0;
  v_output_calls integer := 0;
BEGIN
  IF p_phase IS NULL OR p_phase NOT IN ('goal', 'decision')
     OR jsonb_typeof(p_samples) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_samples) NOT BETWEEN 1 AND 2 THEN
    RAISE EXCEPTION 'invalid_planner_measurements' USING ERRCODE = '22023';
  END IF;
  SELECT t.model_metric_ids INTO v_ids FROM public.jarvis_tasks AS t WHERE t.id = p_task FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  FOR v_sample IN SELECT value FROM jsonb_array_elements(p_samples) LOOP
    v_call := v_sample ->> 'call';
    v_ms := (v_sample ->> 'ms')::integer;
    v_input := (v_sample ->> 'input')::integer;
    v_output := (v_sample ->> 'output')::integer;
    IF v_call IS NULL OR v_call !~ '^[0-9a-f]{64}$'
       OR v_ms IS NULL OR v_ms < 0 OR v_input < 0 OR v_output < 0 THEN
      RAISE EXCEPTION 'invalid_planner_measurements' USING ERRCODE = '22023';
    END IF;
    IF v_call = ANY(v_ids) OR cardinality(v_ids) >= 512 THEN CONTINUE; END IF;
    v_ids := array_append(v_ids, v_call);
    v_elapsed := v_elapsed + v_ms;
    v_calls := v_calls + 1;
    v_input_total := v_input_total + coalesce(v_input, 0);
    v_output_total := v_output_total + coalesce(v_output, 0);
    v_input_calls := v_input_calls + CASE WHEN v_input IS NULL THEN 0 ELSE 1 END;
    v_output_calls := v_output_calls + CASE WHEN v_output IS NULL THEN 0 ELSE 1 END;
  END LOOP;
  IF v_calls > 0 THEN
    UPDATE public.jarvis_tasks AS t
       SET model_metric_ids = v_ids,
           model_calls = t.model_calls + v_calls, model_ms = t.model_ms + v_elapsed,
           provider_input_tokens = t.provider_input_tokens + v_input_total,
           provider_output_tokens = t.provider_output_tokens + v_output_total,
           provider_input_calls = t.provider_input_calls + v_input_calls,
           provider_output_calls = t.provider_output_calls + v_output_calls,
           planner_goal_ms = t.planner_goal_ms + CASE WHEN p_phase = 'goal' THEN v_elapsed ELSE 0 END,
           planner_decision_ms = t.planner_decision_ms + CASE WHEN p_phase = 'decision' THEN v_elapsed ELSE 0 END
     WHERE t.id = p_task;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.jarvis_note_model_metrics(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_note_model_metrics(uuid, text, jsonb) TO service_role;

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
                                          'resolution', a.resolution, 'resolvedAt', a.resolved_at)
                       ORDER BY a.created_at, a.id)
        FROM public.jarvis_activity AS a WHERE a.task_id = t.id AND a.action IS NOT NULL), '[]'::jsonb))
  FROM public.jarvis_tasks AS t WHERE t.id = p_task;
$$;

CREATE OR REPLACE FUNCTION public.jarvis_task_wait_until(p_task uuid, p_controller uuid, p_reason text,
                                                         p_retry_at timestamptz)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $$
  UPDATE public.jarvis_tasks AS t
     SET status = 'waiting',
         blocker = CASE WHEN t.planner_auto_retries < 3 THEN left(p_reason, 300)
                        ELSE 'The planner is still busy. Your task is saved. Continue when ready.' END,
         retry_at = CASE WHEN t.planner_auto_retries < 3 THEN p_retry_at END,
         planner_auto_retries = least(t.planner_auto_retries + 1, 3),
         paused_at = coalesce(t.paused_at, statement_timestamp()), updated_at = statement_timestamp()
   WHERE t.id = p_task AND t.status = 'running' AND t.controller = p_controller;
$$;

COMMIT;
