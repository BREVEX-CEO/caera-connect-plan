-- A planning turn has one holder at a time, every holder gets a new number (so no model permit
-- key is ever reused), a dead holder is replaced when its lease runs out, and an answered turn
-- restores the busy planner's automatic retries. Disposable database only; synthetic account.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.turn_assert(p_ok boolean, p_what text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'planner turn: %', p_what; END IF;
END;
$$;
CREATE TEMP TABLE turn_ids AS SELECT gen_random_uuid() AS user_id, gen_random_uuid() AS conversation_id;
INSERT INTO auth.users (id, email) SELECT user_id, user_id::text || '@example.test' FROM turn_ids;
INSERT INTO public.ocade_conversations (id, user_id, title, surface)
SELECT conversation_id, user_id, 'Turn fixture', 'jarvis' FROM turn_ids;
GRANT SELECT ON turn_ids TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_user uuid := (SELECT user_id FROM turn_ids);
  v_key text := repeat(replace(v_user::text, '-', ''), 4);
  v_device uuid;
  v_task record;
  v_controller uuid;
  v_first integer;
  v_second integer;
BEGIN
  PERFORM public.jarvis_enroll_device(v_key, 'Turn fixture', 'windows', 'test', repeat('a', 64));
  v_device := public.jarvis_approve_device(v_user, public.jarvis_device_code(v_key));
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
  SELECT v_user, v_device, capability, true FROM unnest(ARRAY['master', 'files']) AS grants(capability);
  SELECT * INTO v_task FROM public.jarvis_open_task(v_user, (SELECT conversation_id FROM turn_ids), v_device,
                                                    'Turn fixture', NULL, '[]');

  v_first := public.jarvis_planner_turn(v_task.task_id, v_task.controller, 160);
  PERFORM pg_temp.turn_assert(v_first = 1, 'the first request takes the turn');
  PERFORM pg_temp.turn_assert(public.jarvis_planner_turn(v_task.task_id, v_task.controller, 160) IS NULL,
                              'a second request for a held turn gets nothing');
  PERFORM pg_temp.turn_assert(public.jarvis_planner_turn(v_task.task_id, v_task.controller, 160, v_first) = v_first,
                              'the holder keeps its number for one more model call');
  PERFORM pg_temp.turn_assert(public.jarvis_planner_turn(v_task.task_id, gen_random_uuid(), 160) IS NULL,
                              'a stale controller never takes the turn');

  -- The holder died: its lease runs out and the next request gets a new number.
  UPDATE public.jarvis_tasks SET planner_turn_until = now() - interval '1 second' WHERE id = v_task.task_id;
  v_second := public.jarvis_planner_turn(v_task.task_id, v_task.controller, 160);
  PERFORM pg_temp.turn_assert(v_second = v_first + 1, 'an expired lease is replaced under a new number');
  -- The dead holder wakes up: it cannot end or keep the turn that replaced it.
  PERFORM public.jarvis_planner_turn_end(v_task.task_id, v_first, true);
  PERFORM pg_temp.turn_assert((SELECT planner_turn_until IS NOT NULL FROM public.jarvis_tasks WHERE id = v_task.task_id),
                              'an old holder cannot end a newer turn');
  PERFORM pg_temp.turn_assert(public.jarvis_planner_turn(v_task.task_id, v_task.controller, 160, v_first) IS NULL,
                              'an old holder cannot keep a turn that was replaced');

  PERFORM public.jarvis_planner_turn_end(v_task.task_id, v_second, false);
  PERFORM pg_temp.turn_assert(public.jarvis_planner_turn(v_task.task_id, v_task.controller, 160) = v_second + 1,
                              'an ended turn is free at once, under a new number');

  -- Busy twice, then an answered turn: the automatic retries count consecutive unanswered turns.
  PERFORM public.jarvis_task_wait_until(v_task.task_id, v_task.controller, 'busy', now() - interval '1 second');
  PERFORM pg_temp.turn_assert((SELECT planner_turn_until IS NOT NULL FROM public.jarvis_tasks WHERE id = v_task.task_id),
                              'waiting alone does not end the holder''s turn');
  PERFORM pg_temp.turn_assert(public.jarvis_resume_due(v_device) = v_task.task_id, 'the busy task resumes');
  SELECT t.controller INTO v_controller FROM public.jarvis_tasks AS t WHERE t.id = v_task.task_id;
  PERFORM pg_temp.turn_assert((SELECT planner_turn_until IS NULL AND planner_auto_retries = 1
                                 FROM public.jarvis_tasks WHERE id = v_task.task_id),
                              'a new controller never waits for the old one''s lease');
  v_first := public.jarvis_planner_turn(v_task.task_id, v_controller, 160);
  PERFORM pg_temp.turn_assert(v_first = v_second + 2, 'numbers never repeat across controllers');
  PERFORM public.jarvis_planner_turn_end(v_task.task_id, v_first, false);
  PERFORM pg_temp.turn_assert((SELECT planner_auto_retries = 1 FROM public.jarvis_tasks WHERE id = v_task.task_id),
                              'an unanswered turn keeps the retry count');
  v_first := public.jarvis_planner_turn(v_task.task_id, v_controller, 160);
  PERFORM public.jarvis_planner_turn_end(v_task.task_id, v_first, true);
  PERFORM pg_temp.turn_assert((SELECT planner_auto_retries = 0 AND planner_turn_until IS NULL
                                 FROM public.jarvis_tasks WHERE id = v_task.task_id),
                              'an answered turn restores the automatic retries');

  BEGIN
    PERFORM public.jarvis_planner_turn(v_task.task_id, v_controller, 0);
    RAISE EXCEPTION 'planner turn: a zero-second lease was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END;
$$;
RESET ROLE;
DO $$
BEGIN
  PERFORM pg_temp.turn_assert(
    NOT has_function_privilege('authenticated', 'public.jarvis_planner_turn(uuid, uuid, integer, integer)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.jarvis_planner_turn_end(uuid, integer, boolean)', 'EXECUTE'),
    'only the server may take or end a planning turn');
END;
$$;
ROLLBACK;
