-- The person resolves a step whose effect is unknown: they say whether it took effect.
-- The step itself never runs again; its status and receipt stay as recorded, and a late
-- device receipt still replaces only the unknown marker. No applied migration is edited.
BEGIN;

ALTER TABLE public.jarvis_activity
  ADD COLUMN IF NOT EXISTS resolution text CHECK (resolution IN ('applied', 'not_applied')),
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

CREATE OR REPLACE FUNCTION public.jarvis_resolve_effect(p_user uuid, p_activity uuid, p_resolution text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_task uuid;
BEGIN
  IF p_resolution NOT IN ('applied', 'not_applied') THEN
    RAISE EXCEPTION 'invalid_resolution' USING ERRCODE = '22023';
  END IF;
  SELECT a.task_id INTO v_task FROM public.jarvis_activity AS a
   WHERE a.id = p_activity AND a.user_id = p_user;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  -- Task before action: the lock order claim, STOP and receipts use.
  PERFORM 1 FROM public.jarvis_tasks AS t WHERE t.id = v_task FOR UPDATE;
  -- Only a finished step whose effect may have happened unobserved, answered once, while
  -- nothing runs: an observed or plainly not-applied step needs no answer.
  UPDATE public.jarvis_activity AS a
     SET resolution = p_resolution, resolved_at = statement_timestamp()
   WHERE a.id = p_activity AND a.user_id = p_user AND a.resolution IS NULL
     AND a.status IN ('blocked', 'cancelled', 'failed')
     AND (a.result IS NULL OR a.result ->> 'status' = 'unknown' OR a.result -> 'maybeChanged' = 'true'::jsonb)
     AND coalesce(a.result ->> 'status', '') <> 'observed'
     AND EXISTS (SELECT 1 FROM public.jarvis_tasks AS t
                  WHERE t.id = a.task_id AND t.status IN ('waiting', 'taken_over'));
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_resolve_effect(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_resolve_effect(uuid, uuid, text) TO service_role;

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
                                          'confirmedAt', a.confirmed_at,
                                          'resolution', a.resolution, 'resolvedAt', a.resolved_at)
                       ORDER BY a.created_at, a.id)
        FROM public.jarvis_activity AS a WHERE a.task_id = t.id AND a.action IS NOT NULL), '[]'::jsonb))
  FROM public.jarvis_tasks AS t WHERE t.id = p_task;
$$;


COMMIT;
