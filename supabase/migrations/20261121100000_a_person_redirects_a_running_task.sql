-- LIVE INSTRUCTIONS (plan 14F.4.4, 14F.5.1): while a task is open, the person can tell JARVIS
-- something new, from the website or from the companion's floating bar, for the whole team or for
-- one named agent (lane). Each instruction is an immutable note on the task: who sent it (website
-- or computer), the text, the target agent and the person's own client id (a resend is the same
-- note, never a second one). The planner reads the latest ones at its next turn; nothing already
-- done changes, nothing is granted, and a new permission still has to be given by the person.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS jarvis_activity_one_instruction_per_client
  ON public.jarvis_activity (task_id, (result ->> 'clientId'))
  WHERE status = 'note' AND result ->> 'kind' = 'instruction';

CREATE OR REPLACE FUNCTION public.jarvis_add_instruction(
  p_user uuid, p_task uuid, p_device uuid, p_text text, p_lane smallint, p_client uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_task record;
  v_id uuid;
  v_count integer;
BEGIN
  -- From the computer: its own open task. From the website: the person's own task.
  SELECT t.* INTO v_task FROM public.jarvis_tasks AS t
   WHERE (p_device IS NULL OR t.device_id = p_device)
     AND (p_task IS NULL OR t.id = p_task)
     AND (p_user IS NULL OR t.user_id = p_user)
     AND t.status IN ('running', 'waiting', 'taken_over')
   ORDER BY t.created_at DESC LIMIT 1
   FOR UPDATE;
  IF NOT FOUND OR (p_device IS NULL AND (p_user IS NULL OR p_task IS NULL)) THEN
    RAISE EXCEPTION 'task_not_open' USING ERRCODE = 'P0002';
  END IF;
  IF p_device IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.jarvis_devices AS d
       WHERE d.id = p_device AND d.user_id = v_task.user_id AND d.revoked_at IS NULL) THEN
    RAISE EXCEPTION 'device_unavailable' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(coalesce(p_text, ''))) NOT BETWEEN 1 AND 2000 OR (p_lane IS NOT NULL AND p_lane NOT BETWEEN 0 AND 3) THEN
    RAISE EXCEPTION 'invalid_instruction' USING ERRCODE = '22023';
  END IF;
  SELECT a.id INTO v_id FROM public.jarvis_activity AS a
   WHERE a.task_id = v_task.id AND a.status = 'note' AND a.result ->> 'kind' = 'instruction'
     AND a.result ->> 'clientId' = p_client::text;
  IF FOUND THEN
    RETURN v_id;  -- the same instruction sent again
  END IF;
  SELECT count(*) INTO v_count FROM public.jarvis_activity AS a
   WHERE a.task_id = v_task.id AND a.status = 'note' AND a.result ->> 'kind' = 'instruction';
  IF v_count >= 50 THEN
    RAISE EXCEPTION 'too_many_instructions' USING ERRCODE = '54000';
  END IF;
  INSERT INTO public.jarvis_activity (user_id, task_id, device_id, summary, status, result, created_at)
  VALUES (v_task.user_id, v_task.id, v_task.device_id,
          left('You said: ' || btrim(p_text), 300), 'note',
          jsonb_build_object('kind', 'instruction', 'text', btrim(p_text), 'lane', p_lane,
                             'clientId', p_client::text,
                             'from', CASE WHEN p_device IS NULL THEN 'website' ELSE 'computer' END),
          clock_timestamp())
  RETURNING id INTO v_id;
  UPDATE public.jarvis_tasks AS t SET updated_at = statement_timestamp() WHERE t.id = v_task.id;
  RETURN v_id;
END;
$$;

-- The planner's view of the task carries the latest instructions, oldest first.
CREATE OR REPLACE FUNCTION public.jarvis_task_instructions(p_task uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT coalesce(jsonb_agg(i ORDER BY i ->> 'at'), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('text', a.result ->> 'text', 'lane', a.result -> 'lane',
                              'from', a.result ->> 'from', 'at', a.created_at) AS i
      FROM public.jarvis_activity AS a
     WHERE a.task_id = p_task AND a.status = 'note' AND a.result ->> 'kind' = 'instruction'
     ORDER BY a.created_at DESC LIMIT 10) AS latest;
$$;

REVOKE ALL ON FUNCTION public.jarvis_add_instruction(uuid, uuid, uuid, text, smallint, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jarvis_task_instructions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_add_instruction(uuid, uuid, uuid, text, smallint, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.jarvis_task_instructions(uuid) TO service_role;

COMMIT;
