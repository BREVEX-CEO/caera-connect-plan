BEGIN;

DROP FUNCTION public.jarvis_answer_form(uuid, uuid, uuid, jsonb, uuid, uuid);

UPDATE public.jarvis_tasks SET checkpoint = checkpoint - 'formId' WHERE checkpoint ? 'formId';

CREATE OR REPLACE FUNCTION public.jarvis_form_valid(p_form jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT jsonb_typeof(p_form) = 'array' AND jsonb_array_length(p_form) BETWEEN 1 AND 12
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_form) AS f
        WHERE jsonb_typeof(f) <> 'object'
           OR coalesce(f ->> 'name', '') !~ '^[a-z][a-z0-9_]{0,39}$'
           OR length(coalesce(f ->> 'label', '')) NOT BETWEEN 1 AND 120
           OR coalesce(f ->> 'type', '') NOT IN ('text', 'number', 'date', 'choice', 'long_text')
           OR (f ->> 'type' = 'choice' AND (jsonb_typeof(f -> 'options') <> 'array'
               OR jsonb_array_length(f -> 'options') NOT BETWEEN 2 AND 20)))
     AND (SELECT count(DISTINCT f ->> 'name') FROM jsonb_array_elements(p_form) AS f) = jsonb_array_length(p_form);
$$;

CREATE OR REPLACE FUNCTION public.jarvis_task_ask_form(p_task uuid, p_controller uuid, p_reason text, p_form jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
BEGIN
  IF NOT public.jarvis_form_valid(p_form) THEN
    RAISE EXCEPTION 'invalid_form' USING ERRCODE = '22023';
  END IF;
  UPDATE public.jarvis_tasks AS t
     SET status = 'waiting', blocker = left(p_reason, 300),
         checkpoint = coalesce(t.checkpoint, '{}'::jsonb) || jsonb_build_object('form', p_form),
         paused_at = coalesce(t.paused_at, statement_timestamp()), updated_at = statement_timestamp()
   WHERE t.id = p_task AND t.status = 'running' AND t.controller = p_controller;
  RETURN FOUND;
END;
$$;



CREATE OR REPLACE FUNCTION public.jarvis_answer_form(p_user uuid, p_task uuid, p_values jsonb, p_client uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_task record;
  v_field jsonb;
  v_id uuid;
BEGIN
  SELECT t.* INTO v_task FROM public.jarvis_tasks AS t
   WHERE t.id = p_task AND t.user_id = p_user AND t.status = 'waiting' AND t.checkpoint ? 'form'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'form_not_open' USING ERRCODE = 'P0002';
  END IF;
  IF jsonb_typeof(p_values) <> 'object' OR EXISTS (
       SELECT 1 FROM jsonb_each(p_values) AS v
        WHERE jsonb_typeof(v.value) <> 'string' OR length(v.value #>> '{}') > 1000
           OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_task.checkpoint -> 'form') AS f WHERE f ->> 'name' = v.key)) THEN
    RAISE EXCEPTION 'invalid_answers' USING ERRCODE = '22023';
  END IF;
  FOR v_field IN SELECT value FROM jsonb_array_elements(v_task.checkpoint -> 'form') LOOP
    IF coalesce((v_field ->> 'required')::boolean, false)
       AND length(btrim(coalesce(p_values ->> (v_field ->> 'name'), ''))) = 0 THEN
      RAISE EXCEPTION 'invalid_answers' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  v_id := public.jarvis_add_instruction(p_user, p_task, NULL,
            left('Answers to your form (data for this task): ' || p_values::text, 2000), NULL, p_client);
  UPDATE public.jarvis_tasks AS t SET checkpoint = t.checkpoint - 'form' WHERE t.id = p_task;
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

REVOKE ALL ON FUNCTION public.jarvis_answer_form(uuid, uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_answer_form(uuid, uuid, jsonb, uuid) TO service_role;

COMMIT;
