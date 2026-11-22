BEGIN;

CREATE OR REPLACE FUNCTION public.jarvis_form_valid(p_form jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO ''
AS $$
DECLARE
  v_field jsonb;
  v_options jsonb;
  v_names text[] := ARRAY[]::text[];
BEGIN
  IF jsonb_typeof(p_form) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(p_form) NOT BETWEEN 1 AND 12 THEN RETURN false; END IF;
  FOR v_field IN SELECT value FROM jsonb_array_elements(p_form) LOOP
    IF jsonb_typeof(v_field) <> 'object' THEN RETURN false; END IF;
    IF (v_field - ARRAY['name','label','type','required','options']) <> '{}'::jsonb
       OR jsonb_typeof(v_field -> 'name') IS DISTINCT FROM 'string'
       OR (v_field ->> 'name') !~ '^[a-z][a-z0-9_]{0,39}$'
       OR (v_field ->> 'name') = ANY(v_names)
       OR jsonb_typeof(v_field -> 'label') IS DISTINCT FROM 'string'
       OR length(v_field ->> 'label') NOT BETWEEN 1 AND 120
       OR jsonb_typeof(v_field -> 'type') IS DISTINCT FROM 'string'
       OR (v_field ->> 'type') NOT IN ('text', 'number', 'date', 'choice', 'long_text')
       OR (v_field ? 'required' AND jsonb_typeof(v_field -> 'required') <> 'boolean') THEN
      RETURN false;
    END IF;
    v_names := array_append(v_names, v_field ->> 'name');
    IF v_field ->> 'type' = 'choice' THEN
      v_options := v_field -> 'options';
      IF jsonb_typeof(v_options) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
      IF jsonb_array_length(v_options) NOT BETWEEN 2 AND 20
         OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_options) AS o(value)
                     WHERE jsonb_typeof(o.value) <> 'string' OR length(o.value #>> '{}') NOT BETWEEN 1 AND 80)
         OR (SELECT count(DISTINCT value) FROM jsonb_array_elements(v_options)) <> jsonb_array_length(v_options) THEN
        RETURN false;
      END IF;
    ELSIF v_field ? 'options' THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

-- An issued form has its own identity even if the next question uses the same field names.
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
         checkpoint = coalesce(t.checkpoint, '{}'::jsonb)
           || jsonb_build_object('form', p_form, 'formId', gen_random_uuid()),
         paused_at = coalesce(t.paused_at, statement_timestamp()), updated_at = statement_timestamp()
   WHERE t.id = p_task AND t.status = 'running' AND t.controller = p_controller;
  RETURN FOUND;
END;
$$;

UPDATE public.jarvis_tasks
   SET checkpoint = checkpoint || jsonb_build_object('formId', gen_random_uuid())
 WHERE status = 'waiting' AND NOT (checkpoint ? 'formId')
   AND public.jarvis_form_valid(checkpoint -> 'form');

-- Continuing a paused task cannot skip its unanswered form. The answer transaction clears it
-- before calling the same session, device and STOP-aware resume authority.
CREATE OR REPLACE FUNCTION public.jarvis_resume_task(p_user uuid, p_task uuid, p_session uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_controller uuid := gen_random_uuid();
BEGIN
  IF public.jarvis_paused() THEN
    RAISE EXCEPTION 'jarvis_paused' USING ERRCODE = '42501';
  END IF;
  IF p_session IS NOT NULL AND NOT public.ocade_session_is_live(p_user, p_session) THEN
    RAISE EXCEPTION 'session_ended' USING ERRCODE = '42501';
  END IF;
  UPDATE public.jarvis_tasks AS t
     SET status = 'running', controller = v_controller, blocker = NULL,
         checkpoint = CASE WHEN p_session IS NULL THEN t.checkpoint
                      ELSE coalesce(t.checkpoint, '{}'::jsonb) || jsonb_build_object('authorizedSessionId', p_session) END,
         user_wait_ms = t.user_wait_ms
           + coalesce((extract(epoch FROM statement_timestamp() - t.paused_at) * 1000)::bigint, 0),
         paused_at = NULL, updated_at = statement_timestamp()
   WHERE t.id = p_task AND t.user_id = p_user AND t.status IN ('taken_over', 'waiting')
     AND NOT coalesce(t.checkpoint ? 'formId', false)
     AND (p_session IS NOT NULL OR t.checkpoint ->> 'authorizedSessionId' IS NULL
          OR public.ocade_session_is_live(p_user, (t.checkpoint ->> 'authorizedSessionId')::uuid))
     AND EXISTS (SELECT 1 FROM public.jarvis_devices AS d
                  WHERE d.id = t.device_id AND d.user_id = p_user AND d.revoked_at IS NULL);
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.jarvis_tasks AS t WHERE t.id = p_task AND t.user_id = p_user
                AND t.status = 'waiting' AND t.checkpoint ? 'formId') THEN
      RAISE EXCEPTION 'form_answer_needed' USING ERRCODE = '22023';
    END IF;
    RAISE EXCEPTION 'task_not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_controller;
END;
$$;

DROP FUNCTION public.jarvis_answer_form(uuid, uuid, jsonb, uuid);
CREATE FUNCTION public.jarvis_answer_form(
  p_user uuid, p_task uuid, p_form uuid, p_values jsonb, p_client uuid, p_session uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_task record;
  v_note record;
  v_field jsonb;
  v_value text;
  v_id uuid;
BEGIN
  SELECT t.* INTO v_task FROM public.jarvis_tasks AS t
   WHERE t.id = p_task AND t.user_id = p_user
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'form_not_open' USING ERRCODE = 'P0002'; END IF;
  IF p_session IS NOT NULL AND NOT public.ocade_session_is_live(p_user, p_session) THEN
    RAISE EXCEPTION 'session_ended' USING ERRCODE = '42501';
  END IF;

  -- A lost response can be retried. A late duplicate must never answer or resume a later form.
  SELECT a.id, a.result INTO v_note FROM public.jarvis_activity AS a
   WHERE a.task_id = p_task AND a.status = 'note' AND a.result ->> 'kind' = 'instruction'
     AND a.result ->> 'clientId' = p_client::text;
  IF FOUND THEN
    IF v_note.result ->> 'formId' = p_form::text AND v_note.result -> 'answers' = p_values THEN
      RETURN v_note.id;
    END IF;
    RAISE EXCEPTION 'form_not_open' USING ERRCODE = 'P0002';
  END IF;
  IF p_form IS NULL OR p_client IS NULL OR v_task.status <> 'waiting'
     OR v_task.checkpoint ->> 'formId' IS DISTINCT FROM p_form::text THEN
    RAISE EXCEPTION 'form_not_open' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.jarvis_form_valid(v_task.checkpoint -> 'form')
     OR jsonb_typeof(p_values) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid_answers' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each(p_values) AS v
     WHERE jsonb_typeof(v.value) <> 'string' OR length(v.value #>> '{}') > 1000
       OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_task.checkpoint -> 'form') AS f WHERE f ->> 'name' = v.key)
  ) THEN
    RAISE EXCEPTION 'invalid_answers' USING ERRCODE = '22023';
  END IF;

  FOR v_field IN SELECT value FROM jsonb_array_elements(v_task.checkpoint -> 'form') LOOP
    v_value := p_values ->> (v_field ->> 'name');
    IF v_value IS NULL OR v_value = '' THEN
      IF coalesce((v_field ->> 'required')::boolean, false) THEN
        RAISE EXCEPTION 'invalid_answers' USING ERRCODE = '22023';
      END IF;
      CONTINUE;
    END IF;
    IF (coalesce((v_field ->> 'required')::boolean, false) AND v_value ~ '^[[:space:]]*$')
       OR (v_field ->> 'type' = 'choice' AND NOT ((v_field -> 'options') ? v_value)) THEN
      RAISE EXCEPTION 'invalid_answers' USING ERRCODE = '22023';
    END IF;
    BEGIN
      IF v_field ->> 'type' = 'number' THEN
        IF v_value !~ '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)([eE][+-]?[0-9]+)?$' THEN
          RAISE EXCEPTION 'invalid_answers' USING ERRCODE = '22023';
        END IF;
        PERFORM v_value::double precision;
      ELSIF v_field ->> 'type' = 'date' THEN
        IF v_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
          RAISE EXCEPTION 'invalid_answers' USING ERRCODE = '22023';
        END IF;
        PERFORM v_value::date;
      END IF;
    EXCEPTION WHEN data_exception THEN
      RAISE EXCEPTION 'invalid_answers' USING ERRCODE = '22023';
    END;
  END LOOP;

  -- Reuse the existing instruction limit, author attribution and deduplication. The timeline
  -- sees a generic note, while the planner reads the exact submitted values as structured data.
  v_id := public.jarvis_add_instruction(p_user, p_task, NULL, 'Answered the task form.', NULL, p_client);
  UPDATE public.jarvis_activity
     SET result = result || jsonb_build_object('formId', p_form, 'answers', p_values)
   WHERE id = v_id;
  UPDATE public.jarvis_tasks SET checkpoint = checkpoint - 'form' - 'formId' WHERE id = p_task;
  PERFORM public.jarvis_resume_task(p_user, p_task, p_session);
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
                              'lane', a.result -> 'lane', 'from', a.result ->> 'from', 'at', a.created_at)
           || CASE WHEN a.result ? 'answers' THEN jsonb_build_object('answers', a.result -> 'answers')
                   ELSE '{}'::jsonb END AS i
      FROM public.jarvis_activity AS a
     WHERE a.task_id = p_task AND a.status = 'note' AND a.result ->> 'kind' = 'instruction'
     ORDER BY a.created_at DESC, a.id DESC LIMIT 10) AS latest;
$$;

REVOKE ALL ON FUNCTION public.jarvis_answer_form(uuid, uuid, uuid, jsonb, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_answer_form(uuid, uuid, uuid, jsonb, uuid, uuid) TO service_role;

COMMIT;
