-- R12-02: repeat approval covers one backed-up local edit operation on one exact file.
-- Website/native input keeps its per-action gate. Withdrawal also fences queued edits.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.check(p_ok boolean, p_what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'approvals: %', p_what; END IF;
END $$;
CREATE FUNCTION pg_temp.step(p_key text, p_op text, p_path text, p_deadline text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_array(jsonb_build_object('summary', 'Step ' || p_key, 'action', jsonb_build_object(
    'v', 1, 'key', p_key, 'operation', p_op, 'capability', 'files', 'risk', 'external_effect',
    'arguments', jsonb_build_object('path', p_path, 'expectSha256', repeat('a', 64)),
    'deadlineUtc', p_deadline)));
$$;
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
  v_checks jsonb := '[{"id":"c1","kind":"file_exists","description":"x","params":{"path":"x"}}]';
BEGIN
  PERFORM public.jarvis_enroll_device(v_key, 'SA fixture', 'windows', 'test', repeat('e', 64));
  v_device := public.jarvis_approve_device(v_user, public.jarvis_device_code(v_key));
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
  SELECT v_user, v_device, capability, true
    FROM unnest(ARRAY['master', 'files', 'apps', 'browser', 'computer_control', 'app:excel.exe']) AS g(capability);

  PERFORM pg_temp.check(
    NOT EXISTS (
      SELECT FROM (VALUES
        ('ui.invoke', '{"app":"excel.exe"}'),
        ('ui.set_value', '{"app":"excel.exe"}'),
        ('ui.send_keys', '{"app":"excel.exe"}'),
        ('ui.click_point', '{"app":"excel.exe"}'),
        ('apps.launch', '{"app":"excel.exe"}'),
        ('web.click', '{"site":"example.com"}'),
        ('web.fill', '{"site":"example.com"}'),
        ('web.select', '{"site":"example.com"}'),
        ('shell.run', '{}'),
        ('office.edit_workbook', '{}')
      ) AS unsafe(operation, target)
      WHERE public.jarvis_approval_scope(jsonb_build_object(
        'operation', unsafe.operation, 'target', unsafe.target::jsonb,
        'arguments', jsonb_build_object('path', 'Drafts/a.txt', 'expectSha256', repeat('a', 64))
      )) IS NOT NULL
    ), 'a generic or engine-executed effect was eligible for repeat approval'
  );
  PERFORM pg_temp.check(
    public.jarvis_approval_scope('{"operation":"fs.edit_text","arguments":{"path":"Drafts/a.txt"}}') IS NULL,
    'an edit without an original hash was eligible'
  );

  SELECT * INTO v_task FROM public.jarvis_open_task(
    v_user, (SELECT c FROM sa_ids), v_device, 'SA', v_checks, '[]'
  );
  UPDATE public.jarvis_tasks SET outcome = v_checks WHERE id = v_task.task_id;
  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, pg_temp.step('a1', 'fs.replace_text', 'Drafts/a.txt', v_deadline));
  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, pg_temp.step('a2', 'fs.replace_text', 'Drafts/a.txt', v_deadline));
  v_first := (SELECT id FROM public.jarvis_activity WHERE task_id = v_task.task_id AND action ->> 'key' = 'a1');
  PERFORM pg_temp.check((SELECT count(*) FROM public.jarvis_activity WHERE task_id = v_task.task_id AND status = 'needs_confirmation') = 2,
                        'both wait for the person');
  PERFORM pg_temp.check(NOT public.jarvis_confirm_action(gen_random_uuid(), v_first, true), 'a stranger allowed a step');
  PERFORM pg_temp.check(public.jarvis_confirm_action(v_user, v_first, true), 'allowed for the same file for the rest of the task');
  PERFORM pg_temp.check((SELECT bool_and(status = 'queued' AND confirmed AND confirmed_at IS NOT NULL) FROM public.jarvis_activity
                          WHERE task_id = v_task.task_id), 'the waiting twin was released and both are marked allowed');

  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, pg_temp.step('a3', 'fs.replace_text', 'Drafts/a.txt', v_deadline));
  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, pg_temp.step('b1', 'fs.replace_text', 'Drafts/b.txt', v_deadline));
  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, pg_temp.step('b2', 'fs.edit_text', 'Drafts/a.txt', v_deadline));
  PERFORM pg_temp.check((SELECT string_agg(action ->> 'key' || '=' || status, ',' ORDER BY action ->> 'key') FROM public.jarvis_activity
                          WHERE task_id = v_task.task_id AND action ->> 'key' IN ('a3', 'b1', 'b2'))
                        = 'a3=queued,b1=needs_confirmation,b2=needs_confirmation', 'only the same operation on the same file is pre-allowed');

  PERFORM pg_temp.check(public.jarvis_clear_approvals(gen_random_uuid(), v_task.task_id) = 0, 'a stranger withdrew the scope');
  PERFORM pg_temp.check(public.jarvis_clear_approvals(v_user, v_task.task_id) = 1, 'the scope was withdrawn');
  PERFORM pg_temp.check((SELECT bool_and(status = 'needs_confirmation' AND NOT confirmed AND confirmed_at IS NULL)
                          FROM public.jarvis_activity WHERE task_id = v_task.task_id), 'withdrawal gates the queued edits too');
  PERFORM pg_temp.check(jsonb_array_length(public.jarvis_claim_action(v_device) -> 'actions') = 0,
                        'the companion claimed an edit after withdrawal');
  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, pg_temp.step('a4', 'fs.replace_text', 'Drafts/a.txt', v_deadline));
  PERFORM pg_temp.check((SELECT status FROM public.jarvis_activity WHERE task_id = v_task.task_id AND action ->> 'key' = 'a4') = 'needs_confirmation',
                        'after ask me again, it asks again');
  PERFORM public.jarvis_stop_task(v_user, v_task.task_id);
END $$;
ROLLBACK;
