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
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = p_expected THEN RETURN; END IF;
    RAISE EXCEPTION 'expected "%", got "%" for: %', p_expected, SQLERRM, p_sql;
  END;
  RAISE EXCEPTION 'expected failure "%" but it succeeded: %', p_expected, p_sql;
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
  v_form_id uuid;
  v_later_form_id uuid;
  v_client_id uuid := gen_random_uuid();
  v_note_id uuid;
  v_form jsonb := '[{"name":"amount","label":"Amount","type":"number","required":true},
                    {"name":"reason","label":"Reason","type":"choice","options":["Travel","Food"]},
                    {"name":"date","label":"Date","type":"date"},
                    {"name":"note_a","label":"Note A","type":"long_text"},
                    {"name":"note_b","label":"Note B","type":"long_text"},
                    {"name":"note_c","label":"Note C","type":"long_text"}]';
  v_values jsonb := jsonb_build_object('amount', '42.50', 'reason', 'Travel', 'date', '2028-02-29',
    'note_a', repeat('a', 1000), 'note_b', repeat('b', 1000), 'note_c', repeat('c', 1000));
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
  PERFORM pg_temp.fails(format('SELECT public.jarvis_task_ask_form(%L, %L, %L, %L)', v_task.task_id, v_task.controller, 'x',
    '[{"name":"a","label":"x","type":"choice","options":["Travel","Travel"]}]'), 'invalid_form');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_task_ask_form(%L, %L, %L, %L)', v_task.task_id, v_task.controller, 'x',
    '[{"name":"a","label":"x","type":"choice","options":"Travel"}]'), 'invalid_form');
  PERFORM pg_temp.check(public.jarvis_task_ask_form(v_task.task_id, v_task.controller, 'A few details', v_form), 'asked');
  SELECT (checkpoint ->> 'formId')::uuid INTO v_form_id FROM public.jarvis_tasks WHERE id = v_task.task_id;
  PERFORM pg_temp.check((SELECT status = 'waiting' AND checkpoint ? 'form' AND v_form_id IS NOT NULL
                          FROM public.jarvis_tasks WHERE id = v_task.task_id),
                        'the task waits with its form');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_resume_task(%L, %L)', v_user, v_task.task_id), 'form_answer_needed');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_answer_form(%L, %L, %L, %L, %L)', gen_random_uuid(), v_task.task_id, v_form_id, '{"amount":"5"}', gen_random_uuid()),
                        'form_not_open');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_answer_form(%L, %L, %L, %L, %L, %L)', v_user, v_task.task_id, v_form_id, v_values, v_client_id, gen_random_uuid()),
                        'session_ended');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_answer_form(%L, %L, %L, %L, %L)', v_user, v_task.task_id, v_form_id, '{"reason":"Food"}', gen_random_uuid()),
                        'invalid_answers');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_answer_form(%L, %L, %L, %L, %L)', v_user, v_task.task_id, v_form_id, '{"amount":"5","secret":"x"}', gen_random_uuid()),
                        'invalid_answers');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_answer_form(%L, %L, %L, %L, %L)', v_user, v_task.task_id, v_form_id, '{"amount":"a lot","reason":"Travel"}', gen_random_uuid()),
                        'invalid_answers');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_answer_form(%L, %L, %L, %L, %L)', v_user, v_task.task_id, v_form_id, '{"amount":"42.50","reason":"Unlisted"}', gen_random_uuid()),
                        'invalid_answers');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_answer_form(%L, %L, %L, %L, %L)', v_user, v_task.task_id, v_form_id, '{"amount":"42.50","date":"2026-02-29"}', gen_random_uuid()),
                        'invalid_answers');
  v_note_id := public.jarvis_answer_form(v_user, v_task.task_id, v_form_id, v_values, v_client_id);
  PERFORM pg_temp.check((SELECT status = 'running' AND NOT (checkpoint ?| ARRAY['form','formId'])
                          FROM public.jarvis_tasks WHERE id = v_task.task_id), 'the task resumes and the form is cleared atomically');
  PERFORM pg_temp.check(public.jarvis_task_instructions(v_task.task_id) -> 0 -> 'answers' = v_values
    AND public.jarvis_task_instructions(v_task.task_id) -> 0 ->> 'id' = v_note_id::text,
    'the full answers reach the planner exactly and advance the instruction revision');
  PERFORM pg_temp.check((SELECT summary = 'You said: Answered the task form.' FROM public.jarvis_activity WHERE id = v_note_id), 'the timeline summary does not expose answers');
  PERFORM pg_temp.check(public.jarvis_answer_form(v_user, v_task.task_id, v_form_id, v_values, v_client_id) = v_note_id, 'an identical retry returns its original note');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_answer_form(%L, %L, %L, %L, %L)', v_user, v_task.task_id, v_form_id, '{"amount":"1"}', gen_random_uuid()),
                        'form_not_open');
  PERFORM pg_temp.check(public.jarvis_task_ask_form(v_task.task_id,
    (SELECT controller FROM public.jarvis_tasks WHERE id = v_task.task_id), 'Different question', v_form), 'a second form uses the same field names');
  SELECT (checkpoint ->> 'formId')::uuid INTO v_later_form_id FROM public.jarvis_tasks WHERE id = v_task.task_id;
  PERFORM pg_temp.check(v_later_form_id <> v_form_id, 'same fields get a new identity');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_answer_form(%L, %L, %L, %L, %L)', v_user, v_task.task_id, v_form_id, v_values, gen_random_uuid()),
                        'form_not_open');
  PERFORM pg_temp.check(public.jarvis_answer_form(v_user, v_task.task_id, v_form_id, v_values, v_client_id) = v_note_id, 'later retries remain idempotent');
  PERFORM pg_temp.check((SELECT status = 'waiting' AND checkpoint ->> 'formId' = v_later_form_id::text
                          FROM public.jarvis_tasks WHERE id = v_task.task_id), 'the later form stays open');
  PERFORM public.jarvis_stop_task(v_user, v_task.task_id);
  PERFORM pg_temp.fails(format('SELECT public.jarvis_answer_form(%L, %L, %L, %L, %L)', v_user, v_task.task_id, v_later_form_id, v_values, gen_random_uuid()),
                        'form_not_open');
END $$;
ROLLBACK;
