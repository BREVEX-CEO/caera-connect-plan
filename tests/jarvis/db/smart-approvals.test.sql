-- Smart approvals (R12-02): allowing a step "for the rest of this task" queues later steps of the
-- same operation in the same app without asking, and releases the ones already waiting; another
-- app, another operation or another task still asks; consequential steps (commands) cannot be
-- scoped; "ask me again" withdraws the scope; only the task's owner can do any of it.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.check(p_ok boolean, p_what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'approvals: %', p_what; END IF;
END $$;
CREATE TEMP TABLE sa_ids AS SELECT gen_random_uuid() AS u, gen_random_uuid() AS c;
INSERT INTO auth.users (id, email) SELECT u, u::text || '@example.test' FROM sa_ids;
INSERT INTO public.ocade_conversations (id, user_id, title, surface) SELECT c, u, 'SA', 'jarvis' FROM sa_ids;
GRANT SELECT ON sa_ids TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_user uuid := (SELECT u FROM sa_ids);
  v_key text := repeat(replace(v_user::text, '-', ''), 4);
  v_device uuid;
  v_task record;
  v_deadline text := to_char((now() AT TIME ZONE 'UTC') + interval '5 minutes', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_first uuid;
BEGIN
  PERFORM public.jarvis_enroll_device(v_key, 'SA fixture', 'windows', 'test', repeat('e', 64));
  v_device := public.jarvis_approve_device(v_user, public.jarvis_device_code(v_key));
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
  SELECT v_user, v_device, capability, true
    FROM unnest(ARRAY['master', 'files', 'apps', 'computer_control', 'app:excel.exe', 'app:word.exe']) AS g(capability);
  CREATE FUNCTION pg_temp.step(p_key text, p_op text, p_app text, p_deadline text) RETURNS jsonb LANGUAGE sql AS $f$
    SELECT jsonb_build_array(jsonb_build_object('summary', 'Step ' || p_key, 'action', jsonb_build_object(
      'v', 1, 'key', p_key, 'operation', p_op, 'capability', CASE WHEN p_op = 'shell.run' THEN 'computer_control' ELSE 'apps' END,
      'risk', 'external_effect', 'arguments', '{}'::jsonb, 'deadlineUtc', p_deadline)
      || CASE WHEN p_app IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('target', jsonb_build_object('app', p_app)) END));
  $f$;
  SELECT * INTO v_task FROM public.jarvis_open_task(v_user, (SELECT c FROM sa_ids), v_device, 'SA', '[{"id":"c1","kind":"file_exists","description":"x","params":{"path":"x"}}]'::jsonb, '[]');
  UPDATE public.jarvis_tasks SET outcome = '[{"id":"c1","kind":"file_exists","description":"x","params":{"path":"x"}}]'::jsonb WHERE id = v_task.task_id;
  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, pg_temp.step('a1', 'ui.invoke', 'excel.exe', v_deadline));
  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, pg_temp.step('a2', 'ui.invoke', 'excel.exe', v_deadline));
  v_first := (SELECT id FROM public.jarvis_activity WHERE task_id = v_task.task_id AND action ->> 'key' = 'a1');
  PERFORM pg_temp.check((SELECT count(*) FROM public.jarvis_activity WHERE task_id = v_task.task_id AND status = 'needs_confirmation') = 2,
                        'both wait for the person');
  -- Another person cannot allow it.
  PERFORM pg_temp.check(NOT public.jarvis_confirm_action(gen_random_uuid(), v_first, true), 'a stranger allowed a step');
  PERFORM pg_temp.check(public.jarvis_confirm_action(v_user, v_first, true), 'allowed for the rest of the task');
  PERFORM pg_temp.check((SELECT bool_and(status = 'queued' AND confirmed AND confirmed_at IS NOT NULL) FROM public.jarvis_activity
                          WHERE task_id = v_task.task_id), 'the waiting twin was released and both are marked allowed');
  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, pg_temp.step('a3', 'ui.invoke', 'excel.exe', v_deadline));
  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, pg_temp.step('b1', 'ui.invoke', 'word.exe', v_deadline));
  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, pg_temp.step('b2', 'ui.send_keys', 'excel.exe', v_deadline));
  PERFORM pg_temp.check((SELECT string_agg(action ->> 'key' || '=' || status, ',' ORDER BY created_at) FROM public.jarvis_activity
                          WHERE task_id = v_task.task_id AND action ->> 'key' IN ('a3', 'b1', 'b2'))
                        = 'a3=queued,b1=needs_confirmation,b2=needs_confirmation', 'only the same operation in the same app is pre-allowed');
  -- A command can never be scoped.
  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, pg_temp.step('c1', 'shell.run', NULL, v_deadline));
  BEGIN
    PERFORM public.jarvis_confirm_action(v_user, (SELECT id FROM public.jarvis_activity WHERE task_id = v_task.task_id AND action ->> 'key' = 'c1'), true);
    RAISE EXCEPTION 'approvals: a command was allowed for the rest of the task';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- Ask me again.
  PERFORM pg_temp.check(public.jarvis_clear_approvals(v_user, v_task.task_id) = 1, 'the scope was withdrawn');
  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, pg_temp.step('a4', 'ui.invoke', 'excel.exe', v_deadline));
  PERFORM pg_temp.check((SELECT status FROM public.jarvis_activity WHERE task_id = v_task.task_id AND action ->> 'key' = 'a4') = 'needs_confirmation',
                        'after ask me again, it asks again');
  PERFORM public.jarvis_stop_task(v_user, v_task.task_id);
END $$;
ROLLBACK;
