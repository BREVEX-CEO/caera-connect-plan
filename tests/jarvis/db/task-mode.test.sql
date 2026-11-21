-- Live / Background (R12-01): a task starts Live; only its owner switches it, only while open;
-- in Background typing, clicking and opening windows are refused at queueing; background app
-- control is said to the device only with both the permission and Background; switching keeps
-- every step. Disposable database only.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.check(p_ok boolean, p_what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'mode: %', p_what; END IF;
END $$;
CREATE TEMP TABLE m_ids AS SELECT gen_random_uuid() AS u, gen_random_uuid() AS c;
INSERT INTO auth.users (id, email) SELECT u, u::text || '@example.test' FROM m_ids;
INSERT INTO public.ocade_conversations (id, user_id, title, surface) SELECT c, u, 'M', 'jarvis' FROM m_ids;
GRANT SELECT ON m_ids TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_user uuid := (SELECT u FROM m_ids);
  v_key text := repeat(replace(v_user::text, '-', ''), 4);
  v_device uuid;
  v_task record;
  v_deadline text := to_char((now() AT TIME ZONE 'UTC') + interval '5 minutes', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_step jsonb;
BEGIN
  PERFORM public.jarvis_enroll_device(v_key, 'M fixture', 'windows', 'test', repeat('f', 64));
  v_device := public.jarvis_approve_device(v_user, public.jarvis_device_code(v_key));
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
  SELECT v_user, v_device, capability, true
    FROM unnest(ARRAY['master', 'files', 'apps', 'app:excel.exe', 'background']) AS g(capability);
  SELECT * INTO v_task FROM public.jarvis_open_task(v_user, (SELECT c FROM m_ids), v_device, 'M', NULL, '[]');
  UPDATE public.jarvis_tasks SET outcome = '[{"id":"c1","kind":"file_exists","description":"x","params":{"path":"x"}}]'::jsonb WHERE id = v_task.task_id;
  PERFORM pg_temp.check((public.jarvis_task_state(v_task.task_id) ->> 'mode') = 'live', 'a task starts Live');
  PERFORM pg_temp.check(NOT (public.jarvis_claim_action(v_device) ->> 'backgroundAllowed')::boolean,
                        'Live never says background, whatever the permission');
  BEGIN
    PERFORM public.jarvis_set_task_mode(gen_random_uuid(), v_task.task_id, 'background');
    RAISE EXCEPTION 'mode: a stranger switched the mode';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
  PERFORM public.jarvis_set_task_mode(v_user, v_task.task_id, 'background');
  PERFORM pg_temp.check((public.jarvis_claim_action(v_device) ->> 'backgroundAllowed')::boolean,
                        'Background and the permission: background app control');
  v_step := jsonb_build_array(jsonb_build_object('summary', 'Type', 'action', jsonb_build_object(
    'v', 1, 'key', 'k1', 'operation', 'ui.send_keys', 'capability', 'apps', 'risk', 'external_effect',
    'arguments', '{}'::jsonb, 'target', jsonb_build_object('app', 'excel.exe'), 'deadlineUtc', v_deadline)));
  BEGIN
    PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, v_step);
    RAISE EXCEPTION 'mode: Background queued typing';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM <> 'live_needed' THEN RAISE; END IF;
  END;
  PERFORM public.jarvis_set_task_mode(v_user, v_task.task_id, 'live');
  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, v_step);
  PERFORM pg_temp.check((SELECT count(*) FROM public.jarvis_activity WHERE task_id = v_task.task_id) = 1, 'Live queues it, nothing was lost');
  BEGIN
    PERFORM public.jarvis_set_task_mode(v_user, v_task.task_id, 'background');
    RAISE EXCEPTION 'mode: Background accepted an existing Live step';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    IF SQLERRM <> 'live_mode_in_use' THEN RAISE; END IF;
  END;
  PERFORM pg_temp.check((public.jarvis_task_state(v_task.task_id) ->> 'mode') = 'live', 'refused transition leaves Live intact');
  -- Rehearsal (T12-06): writes only under the rehearsal folder; nothing consequential.
  PERFORM public.jarvis_set_task_mode(v_user, v_task.task_id, 'rehearsal');
  BEGIN
    PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, jsonb_build_array(jsonb_build_object(
      'summary', 'Write', 'action', jsonb_build_object('v', 1, 'key', 'r1', 'operation', 'fs.write_text',
      'capability', 'files', 'risk', 'reversible_write', 'arguments', '{"path":"Reports/q1.txt","text":"x"}'::jsonb,
      'deadlineUtc', v_deadline))));
    RAISE EXCEPTION 'mode: a rehearsal wrote outside its folder';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM <> 'rehearsal_only' THEN RAISE; END IF;
  END;
  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, jsonb_build_array(jsonb_build_object(
    'summary', 'Write', 'action', jsonb_build_object('v', 1, 'key', 'r2', 'operation', 'fs.write_text',
    'capability', 'files', 'risk', 'reversible_write', 'arguments', '{"path":"OCADE output/rehearsal/q1.txt","text":"x"}'::jsonb,
    'deadlineUtc', v_deadline))));
  PERFORM public.jarvis_stop_task(v_user, v_task.task_id);
  BEGIN
    PERFORM public.jarvis_set_task_mode(v_user, v_task.task_id, 'background');
    RAISE EXCEPTION 'mode: a finished task changed mode';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
  -- A first dispatch can only see the selected mode. An exact repeat preserves it.
  SELECT * INTO v_task FROM public.jarvis_open_task_with_mode(
    v_user, (SELECT c FROM m_ids), v_device, 'Second task', NULL, '[]', 'background'
  );
  PERFORM pg_temp.check(public.jarvis_claim_action(v_device) ->> 'mode' = 'background', 'first dispatch sees Background');
  PERFORM pg_temp.check((SELECT reused FROM public.jarvis_open_task_with_mode(
    v_user, (SELECT c FROM m_ids), v_device, 'Second task', NULL, '[]', 'background'
  )), 'duplicate request with the same mode reuses the task');
  BEGIN
    PERFORM public.jarvis_open_task_with_mode(
      v_user, (SELECT c FROM m_ids), v_device, 'Second task', NULL, '[]', 'live'
    );
    RAISE EXCEPTION 'mode: a duplicate request switched execution modes';
  EXCEPTION WHEN lock_not_available THEN
    IF SQLERRM <> 'busy' THEN RAISE; END IF;
  END;
  PERFORM pg_temp.check((public.jarvis_task_state(v_task.task_id) ->> 'mode') = 'background', 'different-mode repeat leaves the task unchanged');
END $$;
RESET ROLE;
SELECT pg_temp.check(NOT has_function_privilege('anon', 'public.jarvis_open_task_with_mode(uuid, uuid, uuid, text, jsonb, jsonb, text, uuid)', 'EXECUTE'),
  'anonymous clients cannot open tasks');
SELECT pg_temp.check(NOT has_function_privilege('authenticated', 'public.jarvis_open_task_with_mode(uuid, uuid, uuid, text, jsonb, jsonb, text, uuid)', 'EXECUTE'),
  'signed-in clients cannot bypass the server session fence');
ROLLBACK;
