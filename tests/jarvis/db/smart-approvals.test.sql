-- Smart Approvals (R12-02): a long task made only of ordinary steps (reads and reversible edits
-- the person's grants already cover) raises no approval at all; a step that reaches beyond the
-- computer still waits for one confirmation, alone. Disposable database only.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.check(p_ok boolean, p_what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'smart approvals: %', p_what; END IF;
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
  v_batch jsonb;
  v_ordinary integer := 0;
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
  PERFORM pg_temp.check((SELECT count(*) FROM public.jarvis_activity
                          WHERE task_id = v_task.task_id AND status = 'done') = 50,
                        'the ordinary steps were not held back');
END $$;
RESET ROLE;
ROLLBACK;
