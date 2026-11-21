-- Rollback of 20261121200000: connections serve their one model again, with no spending policy.
BEGIN;
DROP FUNCTION IF EXISTS public.ocade_byok_models_save(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.ocade_byok_model_set(uuid, uuid, text, boolean, numeric, numeric, text);
DROP FUNCTION IF EXISTS public.ocade_byok_model_record(uuid, uuid, text, boolean, boolean);
DROP FUNCTION IF EXISTS public.ocade_byok_policy(uuid, uuid, text, text, boolean, text, text, numeric, numeric, numeric);
DROP FUNCTION IF EXISTS public.ocade_byok_reserve(uuid, uuid, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.ocade_byok_settle(uuid, uuid, boolean, integer, integer);
CREATE OR REPLACE FUNCTION private.jarvis_task_keeps_its_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_choice public.byok_choices;
BEGIN
  SELECT * INTO v_choice FROM public.byok_choices
   WHERE user_id = NEW.user_id AND surface = 'jarvis';
  NEW.model_customer_key := FOUND;
  NEW.model_connection := CASE WHEN FOUND THEN v_choice.connection_id END;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.ocade_byok_route(p_user_id uuid, p_connection_id uuid, p_surface text)
RETURNS TABLE (id uuid, enabled boolean, status text, protocol text, endpoint text, model text,
  sees_images boolean, calls_tools boolean, secret text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT c.id, c.enabled, c.status, c.protocol, c.endpoint, c.model, c.sees_images, c.calls_tools,
         s.decrypted_secret
    FROM public.byok_connections AS c
    JOIN vault.decrypted_secrets AS s ON s.id = c.secret_id
   WHERE p_connection_id IS NOT NULL AND c.id = p_connection_id AND c.user_id = p_user_id
  UNION ALL
  SELECT c.id, c.enabled, c.status, c.protocol, c.endpoint, c.model, c.sees_images, c.calls_tools,
         s.decrypted_secret
    FROM public.byok_choices AS ch
    LEFT JOIN public.byok_connections AS c ON c.id = ch.connection_id AND c.user_id = ch.user_id
    LEFT JOIN vault.decrypted_secrets AS s ON s.id = c.secret_id
   WHERE p_connection_id IS NULL AND ch.user_id = p_user_id AND ch.surface = p_surface;
$$;
CREATE OR REPLACE FUNCTION public.ocade_byok_route_for_turn(p_user_id uuid, p_idempotency_key text)
RETURNS TABLE (id uuid, enabled boolean, status text, protocol text, endpoint text, model text,
  sees_images boolean, calls_tools boolean, secret text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH turn AS (
    SELECT t.model_customer_key, t.model_connection
      FROM public.ocade_generation_permits AS p
      JOIN public.jarvis_tasks AS t ON t.id = p.task_id AND t.user_id = p.user_id
     WHERE p.user_id = p_user_id AND p.idempotency_key = btrim(p_idempotency_key))
  SELECT c.id, c.enabled, c.status, c.protocol, c.endpoint, c.model, c.sees_images, c.calls_tools,
         s.decrypted_secret
    FROM turn
    LEFT JOIN public.byok_connections AS c ON c.id = turn.model_connection AND c.user_id = p_user_id
    LEFT JOIN vault.decrypted_secrets AS s ON s.id = c.secret_id
   WHERE turn.model_customer_key
  UNION ALL
  SELECT r.* FROM public.ocade_byok_route(p_user_id, NULL, 'jarvis') AS r
   WHERE NOT EXISTS (SELECT 1 FROM turn);
$$;
CREATE OR REPLACE FUNCTION public.jarvis_task_state(p_task uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT jsonb_build_object(
    'id', t.id, 'userId', t.user_id, 'status', t.status, 'controller', t.controller, 'mode', t.mode,
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
DROP FUNCTION IF EXISTS private.byok_cost(public.byok_connections, text, integer, integer);
DROP FUNCTION IF EXISTS private.byok_model_for(uuid, text);
DROP FUNCTION IF EXISTS private.byok_model_sees(uuid, text);
DROP TABLE IF EXISTS public.byok_spend;
DROP TABLE IF EXISTS public.byok_models;
ALTER TABLE public.jarvis_tasks DROP COLUMN IF EXISTS model_name;
ALTER TABLE public.byok_connections
  DROP COLUMN IF EXISTS model_mode, DROP COLUMN IF EXISTS spend_mode, DROP COLUMN IF EXISTS free_tier,
  DROP COLUMN IF EXISTS budget_currency, DROP COLUMN IF EXISTS budget_time_zone,
  DROP COLUMN IF EXISTS budget_task, DROP COLUMN IF EXISTS budget_day,
  DROP COLUMN IF EXISTS budget_month, DROP COLUMN IF EXISTS models_listed_at;
COMMIT;
