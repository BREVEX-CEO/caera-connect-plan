BEGIN;

-- Select the mode before anyone can claim the first step. Keep the existing
-- admission function and its ownership, device, permission and session checks.
CREATE FUNCTION public.jarvis_open_task_with_mode(
  p_user uuid, p_conversation uuid, p_device uuid, p_title text, p_outcome jsonb, p_plan jsonb,
  p_mode text, p_session uuid DEFAULT NULL
)
RETURNS TABLE (task_id uuid, status text, controller uuid, reused boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_open record;
  v_mode text;
BEGIN
  IF p_mode IS NULL OR p_mode NOT IN ('live', 'background') THEN
    RAISE EXCEPTION 'invalid_mode' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO STRICT v_open FROM public.jarvis_open_task(
    p_user, p_conversation, p_device, p_title, p_outcome, p_plan, p_session
  );
  IF v_open.reused THEN
    SELECT t.mode INTO v_mode FROM public.jarvis_tasks AS t WHERE t.id = v_open.task_id FOR UPDATE;
    IF v_mode IS DISTINCT FROM p_mode THEN
      RAISE EXCEPTION 'busy' USING ERRCODE = '55P03';
    END IF;
  ELSIF p_mode = 'background' THEN
    UPDATE public.jarvis_tasks AS t SET mode = p_mode WHERE t.id = v_open.task_id;
  END IF;
  RETURN QUERY SELECT v_open.task_id, v_open.status, v_open.controller, v_open.reused;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_open_task_with_mode(uuid, uuid, uuid, text, jsonb, jsonb, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_open_task_with_mode(uuid, uuid, uuid, text, jsonb, jsonb, text, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.jarvis_set_task_mode(p_user uuid, p_task uuid, p_mode text)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_mode text;
BEGIN
  IF p_mode IS NULL OR p_mode NOT IN ('live', 'background', 'rehearsal') THEN
    RAISE EXCEPTION 'invalid_mode' USING ERRCODE = '22023';
  END IF;
  SELECT t.mode INTO v_mode FROM public.jarvis_tasks AS t
   WHERE t.id = p_task AND t.user_id = p_user AND t.status IN ('running', 'waiting', 'taken_over')
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task_not_open' USING ERRCODE = 'P0002';
  END IF;
  -- Claim and queue take the same task lock. A change to Background cannot
  -- promise to leave the controls alone while an existing Live step can still run.
  IF p_mode = 'background' AND v_mode <> p_mode AND EXISTS (
    SELECT 1 FROM public.jarvis_activity AS a
     WHERE a.task_id = p_task AND a.status IN ('queued', 'claimed', 'needs_confirmation')
       AND a.action ->> 'operation' IN ('ui.send_keys', 'ui.click_point', 'apps.launch')
  ) THEN
    RAISE EXCEPTION 'live_mode_in_use' USING ERRCODE = '55000';
  END IF;
  UPDATE public.jarvis_tasks AS t SET mode = p_mode, updated_at = statement_timestamp()
   WHERE t.id = p_task;
  RETURN p_mode;
END;
$$;

COMMIT;
