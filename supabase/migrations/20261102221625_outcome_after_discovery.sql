-- A task's acceptance checks are fixed after a read-only look at the device, not guessed
-- before anything is observed. A task may open with no checks; until the controller sets
-- them once, only reads can be queued. Checks never change afterwards (the existing
-- trigger now allows exactly the one NULL-to-checks change). No applied migration is edited.
BEGIN;

-- Checks are set once (NULL to a list) after the first look, then never change.
CREATE OR REPLACE FUNCTION public.jarvis_task_outcome_is_fixed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF NEW.outcome IS DISTINCT FROM OLD.outcome AND OLD.outcome IS NOT NULL THEN
    RAISE EXCEPTION 'A task''s checks are fixed once they are set' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

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
REVOKE ALL ON FUNCTION public.jarvis_set_outcome(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_set_outcome(uuid, uuid, jsonb, jsonb) TO service_role;

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


-- An inexpensive early check before a task opens; the intelligence service re-reads consent.
CREATE OR REPLACE FUNCTION public.jarvis_online_consented(p_user uuid, p_version text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT coalesce((SELECT p.online_ai_consent_at IS NOT NULL AND p.online_ai_consent_version = p_version
                     FROM public.profiles AS p WHERE p.id = p_user), false);
$$;
REVOKE ALL ON FUNCTION public.jarvis_online_consented(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_online_consented(uuid, text) TO service_role;

COMMIT;
