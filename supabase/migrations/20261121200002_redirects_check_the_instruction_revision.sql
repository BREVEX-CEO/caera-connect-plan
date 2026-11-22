-- Bind redirects from the website and paired companion to the last instruction seen.
-- The task lock serializes the revision check with form answers and other redirects.
BEGIN;

CREATE FUNCTION public.jarvis_instruction_revision(p_task uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT a.id FROM public.jarvis_activity AS a
   WHERE a.task_id = p_task AND a.status = 'note' AND a.result ->> 'kind' = 'instruction'
   ORDER BY a.created_at DESC, a.id DESC LIMIT 1;
$$;

CREATE FUNCTION public.jarvis_redirect_task(
  p_user uuid, p_task uuid, p_device uuid, p_text text, p_lane smallint, p_client uuid,
  p_previous uuid, p_session uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_task record;
  v_existing record;
  v_id uuid;
BEGIN
  SELECT t.user_id, (t.checkpoint ->> 'authorizedSessionId')::uuid AS session_id
    INTO v_task FROM public.jarvis_tasks AS t
   WHERE t.id = p_task AND t.status IN ('running', 'waiting', 'taken_over')
     AND ((p_device IS NULL AND t.user_id = p_user)
          OR (p_user IS NULL AND t.device_id = p_device AND EXISTS (
            SELECT 1 FROM public.jarvis_devices AS d
             WHERE d.id = p_device AND d.user_id = t.user_id AND d.revoked_at IS NULL)))
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task_not_open' USING ERRCODE = 'P0002';
  END IF;
  IF (p_user IS NOT NULL AND (p_session IS NULL
        OR NOT public.ocade_session_is_live(p_user, p_session)))
     OR (v_task.session_id IS NOT NULL
        AND NOT public.ocade_session_is_live(v_task.user_id, v_task.session_id)) THEN
    RAISE EXCEPTION 'session_ended' USING ERRCODE = '42501';
  END IF;
  IF p_client IS NULL THEN
    RAISE EXCEPTION 'invalid_instruction' USING ERRCODE = '22023';
  END IF;

  SELECT a.id, a.result INTO v_existing FROM public.jarvis_activity AS a
   WHERE a.task_id = p_task AND a.status = 'note' AND a.result ->> 'kind' = 'instruction'
     AND a.result ->> 'clientId' = p_client::text;
  IF FOUND THEN
    IF NOT (v_existing.result ? 'previousInstructionId')
       OR (v_existing.result ->> 'previousInstructionId')::uuid IS DISTINCT FROM p_previous
       OR v_existing.result ->> 'text' IS DISTINCT FROM btrim(p_text)
       OR (v_existing.result ->> 'lane')::smallint IS DISTINCT FROM p_lane
       OR v_existing.result ->> 'from' IS DISTINCT FROM
           (CASE WHEN p_device IS NULL THEN 'website' ELSE 'computer' END) THEN
      RAISE EXCEPTION 'instruction_conflict' USING ERRCODE = '40001';
    END IF;
    RETURN v_existing.id;
  END IF;

  IF public.jarvis_instruction_revision(p_task) IS DISTINCT FROM p_previous THEN
    RAISE EXCEPTION 'instruction_conflict' USING ERRCODE = '40001';
  END IF;
  v_id := public.jarvis_add_instruction(p_user, p_task, p_device, p_text, p_lane, p_client);
  UPDATE public.jarvis_activity
     SET result = result || jsonb_build_object('previousInstructionId', p_previous,
                                               'authorSessionId', p_session)
   WHERE id = v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.jarvis_task_instructions(p_task uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT coalesce(jsonb_agg(i ORDER BY created_at, id), '[]'::jsonb) FROM (
    SELECT a.created_at, a.id, jsonb_build_object('id', a.id, 'text', a.result ->> 'text',
      'lane', a.result -> 'lane', 'from', a.result ->> 'from', 'at', a.created_at) AS i
      FROM public.jarvis_activity AS a
     WHERE a.task_id = p_task AND a.status = 'note' AND a.result ->> 'kind' = 'instruction'
     ORDER BY a.created_at DESC, a.id DESC LIMIT 10) AS latest;
$$;

-- Extend the claim response in the same transaction without changing the worker's lease rules.
CREATE FUNCTION public.jarvis_claim_with_instruction(p_device uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_claim jsonb := public.jarvis_claim_action(p_device);
  v_task uuid := (v_claim #>> '{task,id}')::uuid;
BEGIN
  IF v_task IS NOT NULL THEN
    v_claim := jsonb_set(v_claim, '{task,instructionRevision}',
      coalesce(to_jsonb(public.jarvis_instruction_revision(v_task)), 'null'::jsonb));
  END IF;
  RETURN v_claim;
END;
$$;

REVOKE ALL ON FUNCTION public.jarvis_instruction_revision(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jarvis_redirect_task(uuid, uuid, uuid, text, smallint, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jarvis_claim_with_instruction(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_instruction_revision(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.jarvis_redirect_task(uuid, uuid, uuid, text, smallint, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.jarvis_claim_with_instruction(uuid) TO service_role;

COMMIT;
