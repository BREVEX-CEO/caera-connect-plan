-- P5: a task whose objective names apps as @app queues actions only for those apps; a task
-- that names none may use every allowed app; naming an app that is not allowed grants nothing.
-- Disposable database only; every account/device is synthetic.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.scope_assert(p_ok boolean, p_what text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'app scope: %', p_what; END IF;
END;
$$;
CREATE TEMP TABLE scope_ids AS SELECT gen_random_uuid() AS user_id, gen_random_uuid() AS conversation_id;
INSERT INTO auth.users (id, email) SELECT user_id, user_id::text || '@example.test' FROM scope_ids;
INSERT INTO public.ocade_conversations (id, user_id, title, surface)
SELECT conversation_id, user_id, 'Scope fixture', 'jarvis' FROM scope_ids;
GRANT SELECT ON scope_ids TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_user uuid := (SELECT user_id FROM scope_ids);
  v_key text := repeat(replace(v_user::text, '-', ''), 4);
  v_device uuid;
  v_task record;
  v_case record;
  v_refused text;
  v_deadline text := to_char((now() AT TIME ZONE 'UTC') + interval '5 minutes', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
  PERFORM public.jarvis_enroll_device(v_key, 'Scope fixture', 'windows', 'test', repeat('c', 64));
  v_device := public.jarvis_approve_device(v_user, public.jarvis_device_code(v_key));
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
  SELECT v_user, v_device, capability, true
    FROM unnest(ARRAY['master', 'files', 'apps', 'app:editor.exe', 'app:calc.exe']) AS grants(capability);

  FOR v_case IN SELECT * FROM (VALUES
    ('Tidy the note in @editor.exe please', 'editor.exe', NULL),
    ('Tidy the note in @editor.exe please', 'calc.exe', 'app_out_of_scope'),
    ('Use @Editor.exe, then @calc.exe', 'calc.exe', NULL),
    ('Tidy the note in any app', 'calc.exe', NULL),
    ('Mail me at someone@calc.exe.example later', 'editor.exe', NULL),
    ('Use @paint.exe, which is not allowed', 'editor.exe', NULL)
  ) AS cases(title, app, refused) LOOP
    SELECT * INTO v_task FROM public.jarvis_open_task(v_user, (SELECT conversation_id FROM scope_ids), v_device,
                                                      v_case.title, NULL, '[]');
    v_refused := NULL;
    BEGIN
      PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, jsonb_build_array(jsonb_build_object(
        'summary', 'Look', 'action', jsonb_build_object(
          'v', 1, 'key', 's1', 'operation', 'ui.inspect', 'capability', 'apps', 'risk', 'read',
          'arguments', jsonb_build_object('window', jsonb_build_object('exe', v_case.app, 'pid', 4, 'hwnd', 5, 'started', 6)),
          'target', jsonb_build_object('app', v_case.app), 'deadlineUtc', v_deadline))));
    EXCEPTION WHEN insufficient_privilege THEN
      v_refused := SQLERRM;
    END;
    PERFORM pg_temp.scope_assert(v_refused IS NOT DISTINCT FROM v_case.refused,
                                 format('%s -> %s: got %s', v_case.title, v_case.app, coalesce(v_refused, 'queued')));
    PERFORM public.jarvis_stop_task(v_user, v_task.task_id);
  END LOOP;
END;
$$;
ROLLBACK;
