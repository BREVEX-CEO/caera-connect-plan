-- Live instructions (plan 14F.4.4): a person adds an instruction to their own open task from the
-- website or the paired computer; a resend with the same client id is the same note; another
-- person, a finished task, a removed computer, empty text or a bad agent number are refused; a
-- signed-in person cannot call the step; the planner reads the latest ones. Disposable DB only.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.check(p_ok boolean, p_what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'instructions: %', p_what; END IF;
END $$;
CREATE FUNCTION pg_temp.fails(p_sql text, p_expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'expected failure "%" but it succeeded: %', p_expected, p_sql;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%' || p_expected || '%' THEN
    RAISE EXCEPTION 'expected "%", got "%" for: %', p_expected, SQLERRM, p_sql;
  END IF;
END $$;
CREATE TEMP TABLE ins_ids AS SELECT gen_random_uuid() AS a, gen_random_uuid() AS b, gen_random_uuid() AS conv;
INSERT INTO auth.users (id, email) SELECT a, a::text || '@example.test' FROM ins_ids
  UNION ALL SELECT b, b::text || '@example.test' FROM ins_ids;
INSERT INTO public.ocade_conversations (id, user_id, title, surface) SELECT conv, a, 'I', 'jarvis' FROM ins_ids;
GRANT SELECT ON ins_ids TO service_role, authenticated;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_a uuid := (SELECT a FROM ins_ids);
  v_b uuid := (SELECT b FROM ins_ids);
  v_key text := repeat(replace(v_a::text, '-', ''), 4);
  v_device uuid;
  v_task record;
  v_old_task uuid;
  v_client uuid := gen_random_uuid();
  v_one uuid;
BEGIN
  PERFORM public.jarvis_enroll_device(v_key, 'Ins fixture', 'windows', 'test', repeat('d', 64));
  v_device := public.jarvis_approve_device(v_a, public.jarvis_device_code(v_key));
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
  SELECT v_a, v_device, capability, true FROM unnest(ARRAY['master', 'files']) AS g(capability);
  SELECT * INTO v_task FROM public.jarvis_open_task(v_a, (SELECT conv FROM ins_ids), v_device, 'Ins', NULL, '[]');

  v_one := public.jarvis_add_instruction(v_a, v_task.task_id, NULL, 'Use the blue logo', NULL, v_client);
  PERFORM pg_temp.check(public.jarvis_add_instruction(v_a, v_task.task_id, NULL, 'Use the blue logo', NULL, v_client) = v_one,
                        'a resend is the same instruction');
  PERFORM public.jarvis_add_instruction(NULL, v_task.task_id, v_device, 'Agent 2: smaller', 1::smallint, gen_random_uuid());
  PERFORM pg_temp.check((SELECT jsonb_agg(i ->> 'from') FROM jsonb_array_elements(public.jarvis_task_instructions(v_task.task_id)) AS i)
                        = '["website", "computer"]'::jsonb, 'the planner reads both, oldest first');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_add_instruction(%L, %L, NULL, %L, NULL, %L)', v_b, v_task.task_id, 'hijack', gen_random_uuid()),
                        'task_not_open');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_add_instruction(%L, %L, NULL, %L, NULL, %L)', v_a, v_task.task_id, '   ', gen_random_uuid()),
                        'invalid_instruction');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_add_instruction(%L, %L, NULL, %L, 7::smallint, %L)', v_a, v_task.task_id, 'x', gen_random_uuid()),
                        'invalid_instruction');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_add_instruction(NULL, NULL, NULL, %L, NULL, %L)', 'x', gen_random_uuid()),
                        'task_not_open');
  PERFORM public.jarvis_stop_task(v_a, v_task.task_id);
  PERFORM pg_temp.fails(format('SELECT public.jarvis_add_instruction(%L, %L, NULL, %L, NULL, %L)', v_a, v_task.task_id, 'late', gen_random_uuid()),
                        'task_not_open');
  v_old_task := v_task.task_id;
  SELECT * INTO v_task FROM public.jarvis_open_task(v_a, (SELECT conv FROM ins_ids), v_device, 'New task', NULL, '[]');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_add_instruction(NULL, %L, %L, %L, NULL, %L)',
                        v_old_task, v_device, 'Queued before reconnect', gen_random_uuid()), 'task_not_open');
  PERFORM pg_temp.check(public.jarvis_task_instructions(v_task.task_id) = '[]'::jsonb,
                        'reconnecting does not redirect a queued instruction to a new task on the same device');
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT a FROM ins_ids), 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.jarvis_add_instruction(NULL, NULL, NULL, 'x', NULL, gen_random_uuid());
    RAISE EXCEPTION 'instructions: a person called the server step';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;
