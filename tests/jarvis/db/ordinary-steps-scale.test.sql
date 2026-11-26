-- Smart Approvals at scale (R12-02): a long task of ordinary steps raises no approval; a step that
-- reaches beyond the computer waits alone; scopes cover one exact file, never a command, and can be
-- withdrawn; a stopped task accepts nothing. Disposable database only.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.check(p_ok boolean, p_what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'smart approvals: %', p_what; END IF;
END $$;
CREATE FUNCTION pg_temp.edit(p_key text, p_path text, p_deadline text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('v', 1, 'key', p_key, 'operation', 'fs.edit_text', 'capability', 'files',
    'risk', 'external_effect', 'arguments', jsonb_build_object('path', p_path, 'expectSha256', repeat('a', 64)),
    'target', jsonb_build_object('path', p_path), 'deadlineUtc', p_deadline);
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
  v_batch jsonb;
  v_ordinary integer := 0;
  v_pending uuid;
  v_key_n integer := 0;
BEGIN
  PERFORM public.jarvis_enroll_device(v_key, 'SA fixture', 'windows', 'test', repeat('e', 64));
  v_device := public.jarvis_approve_device(v_user, public.jarvis_device_code(v_key));
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
  SELECT v_user, v_device, capability, true
    FROM unnest(ARRAY['master', 'files', 'apps', 'app:excel.exe']) AS g(capability);
  SELECT * INTO v_task FROM public.jarvis_open_task(v_user, (SELECT c FROM sa_ids), v_device, 'SA', NULL, '[]');
  UPDATE public.jarvis_tasks SET outcome = '[{"id":"c1","kind":"file_exists","description":"x","params":{"path":"x"}}]'::jsonb,
         plan = '[{"stepBudget": 60}]'::jsonb
   WHERE id = v_task.task_id;

  -- 50 ordinary steps: 25 reads and 25 reversible edits, queued ten at a time as the device finishes each batch.
  FOR batch IN 0..4 LOOP
    SELECT jsonb_agg(jsonb_build_object('summary', 'Step ' || (batch * 10 + n), 'action', jsonb_build_object(
             'v', 1, 'key', 'ord-' || (batch * 10 + n),
             'operation', CASE WHEN n % 2 = 0 THEN 'fs.list' ELSE 'fs.write_text' END,
             'capability', 'files',
             'risk', CASE WHEN n % 2 = 0 THEN 'read' ELSE 'reversible_write' END,
             'arguments', '{}'::jsonb, 'target', jsonb_build_object('path', 'notes'), 'deadlineUtc', v_deadline)))
      INTO v_batch FROM generate_series(0, 9) AS s(n);
    PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, v_batch);
    UPDATE public.jarvis_activity SET status = 'done' WHERE task_id = v_task.task_id AND status = 'queued'; -- the device ran them
  END LOOP;
  SELECT count(*) INTO v_ordinary FROM public.jarvis_activity WHERE task_id = v_task.task_id;
  PERFORM pg_temp.check(v_ordinary = 50, '50 ordinary steps queued, got ' || v_ordinary);
  PERFORM pg_temp.check((SELECT count(*) FROM public.jarvis_activity
                          WHERE task_id = v_task.task_id AND status = 'needs_confirmation') = 0,
                        'a 50-step ordinary task raises no approval');

  -- One step that reaches beyond the computer waits alone.
  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, jsonb_build_array(jsonb_build_object(
    'summary', 'Send', 'action', jsonb_build_object('v', 1, 'key', 'ext-1', 'operation', 'ui.send_keys',
      'capability', 'apps', 'risk', 'external_effect', 'arguments', '{}'::jsonb,
      'target', jsonb_build_object('app', 'excel.exe'), 'deadlineUtc', v_deadline))));
  PERFORM pg_temp.check((SELECT count(*) FROM public.jarvis_activity
                          WHERE task_id = v_task.task_id AND status = 'needs_confirmation') = 1,
                        'exactly the external effect waits for approval');

  -- A command-like step cannot be allowed for the rest of the task: it is confirmed alone.
  v_pending := (SELECT id FROM public.jarvis_activity WHERE task_id = v_task.task_id AND status = 'needs_confirmation');
  BEGIN
    PERFORM public.jarvis_confirm_action(v_user, v_pending, true);
    RAISE EXCEPTION 'smart approvals: an unscopable step was allowed for the task';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM <> 'approval_not_scopable' THEN RAISE; END IF;
  END;
  PERFORM pg_temp.check(public.jarvis_task_approvals(v_task.task_id) = 0, 'no scope was recorded');
  PERFORM pg_temp.check(public.jarvis_confirm_action(v_user, v_pending, false), 'it is confirmed once');

  -- An edit of one exact file can be allowed for the task: the same file again is spared,
  -- another file is a new decision.
  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, jsonb_build_array(jsonb_build_object(
    'summary', 'Edit a', 'action', pg_temp.edit('edit-1', 'a.txt', v_deadline))));
  v_pending := (SELECT id FROM public.jarvis_activity WHERE action ->> 'key' = 'edit-1');
  PERFORM pg_temp.check((SELECT status FROM public.jarvis_activity WHERE id = v_pending) = 'needs_confirmation', 'a first file edit asks');
  PERFORM pg_temp.check(public.jarvis_confirm_action(v_user, v_pending, true), 'the person allows this file for the task');
  UPDATE public.jarvis_activity SET status = 'done' WHERE task_id = v_task.task_id AND status = 'queued';
  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, jsonb_build_array(
    jsonb_build_object('summary', 'Edit a again', 'action', pg_temp.edit('edit-2', 'a.txt', v_deadline))));
  PERFORM pg_temp.check((SELECT status FROM public.jarvis_activity WHERE action ->> 'key' = 'edit-2') = 'queued',
                        'the same file is not asked about twice');
  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, jsonb_build_array(
    jsonb_build_object('summary', 'Edit b', 'action', pg_temp.edit('edit-3', 'b.txt', v_deadline))));
  PERFORM pg_temp.check((SELECT status FROM public.jarvis_activity WHERE action ->> 'key' = 'edit-3') = 'needs_confirmation',
                        'another file is a new decision');

  -- "Ask me again" withdraws every scope.
  PERFORM pg_temp.check(public.jarvis_task_approvals(v_task.task_id) = 1, 'one scope recorded');
  PERFORM public.jarvis_clear_approvals(v_user, v_task.task_id);
  PERFORM pg_temp.check(public.jarvis_task_approvals(v_task.task_id) = 0, 'ask me again withdraws the scope');

  -- "Deny and stop" ends the task: nothing is queued afterwards and the person is not asked again.
  PERFORM public.jarvis_stop_task(v_user, v_task.task_id);
  BEGIN
    PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, jsonb_build_array(
      jsonb_build_object('summary', 'Retry', 'action', pg_temp.edit('edit-4', 'b.txt', v_deadline))));
    RAISE EXCEPTION 'smart approvals: a stopped task accepted a step';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM <> 'stale_controller' THEN RAISE; END IF;
  END;
  PERFORM pg_temp.check((SELECT count(*) FROM public.jarvis_activity WHERE action ->> 'key' = 'edit-4') = 0,
                        'no prompt after the task was stopped');
END $$;
RESET ROLE;
ROLLBACK;
