-- Generated forms (R12-06): a task asks with a valid form and waits; only its owner answers, only
-- its fields, required ones present; the answers become one instruction and the form is cleared;
-- a second answer finds no open form; malformed forms are refused. Disposable database only.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.check(p_ok boolean, p_what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'forms: %', p_what; END IF;
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
CREATE TEMP TABLE f_ids AS SELECT gen_random_uuid() AS u, gen_random_uuid() AS c;
INSERT INTO auth.users (id, email) SELECT u, u::text || '@example.test' FROM f_ids;
INSERT INTO public.ocade_conversations (id, user_id, title, surface) SELECT c, u, 'F', 'jarvis' FROM f_ids;
GRANT SELECT ON f_ids TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_user uuid := (SELECT u FROM f_ids);
  v_key text := repeat(replace(v_user::text, '-', ''), 4);
  v_device uuid;
  v_task record;
  v_form jsonb := '[{"name":"amount","label":"Amount","type":"number","required":true},
                    {"name":"reason","label":"Reason","type":"choice","options":["Travel","Food"]}]';
BEGIN
  PERFORM public.jarvis_enroll_device(v_key, 'F fixture', 'windows', 'test', repeat('1', 64));
  v_device := public.jarvis_approve_device(v_user, public.jarvis_device_code(v_key));
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
  SELECT v_user, v_device, capability, true FROM unnest(ARRAY['master', 'files']) AS g(capability);
  SELECT * INTO v_task FROM public.jarvis_open_task(v_user, (SELECT c FROM f_ids), v_device, 'F', NULL, '[]');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_task_ask_form(%L, %L, %L, %L)', v_task.task_id, v_task.controller, 'x',
    '[{"name":"Bad Name","label":"x","type":"text"}]'), 'invalid_form');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_task_ask_form(%L, %L, %L, %L)', v_task.task_id, v_task.controller, 'x',
    '[{"name":"a","label":"x","type":"text"},{"name":"a","label":"y","type":"text"}]'), 'invalid_form');
  PERFORM pg_temp.check(public.jarvis_task_ask_form(v_task.task_id, v_task.controller, 'A few details', v_form), 'asked');
  PERFORM pg_temp.check((SELECT status = 'waiting' AND checkpoint ? 'form' FROM public.jarvis_tasks WHERE id = v_task.task_id),
                        'the task waits with its form');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_answer_form(%L, %L, %L, %L)', gen_random_uuid(), v_task.task_id, '{"amount":"5"}', gen_random_uuid()),
                        'form_not_open');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_answer_form(%L, %L, %L, %L)', v_user, v_task.task_id, '{"reason":"Food"}', gen_random_uuid()),
                        'invalid_answers');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_answer_form(%L, %L, %L, %L)', v_user, v_task.task_id, '{"amount":"5","secret":"x"}', gen_random_uuid()),
                        'invalid_answers');
  PERFORM public.jarvis_answer_form(v_user, v_task.task_id, '{"amount":"42.50","reason":"Travel"}', gen_random_uuid());
  PERFORM pg_temp.check((SELECT NOT (checkpoint ? 'form') FROM public.jarvis_tasks WHERE id = v_task.task_id), 'the form is cleared');
  PERFORM pg_temp.check(public.jarvis_task_instructions(v_task.task_id) -> 0 ->> 'text' LIKE '%42.50%', 'the planner reads the answers');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_answer_form(%L, %L, %L, %L)', v_user, v_task.task_id, '{"amount":"1"}', gen_random_uuid()),
                        'form_not_open');
  PERFORM public.jarvis_stop_task(v_user, v_task.task_id);
END $$;
ROLLBACK;
