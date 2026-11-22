-- Parallel lanes (plan 14F.3, O-07): steps in different lanes are handed out together and run at
-- the same time, each lane in its own order; the database derives every step's resources itself
-- and refuses a lane split that would let two lanes touch one file (or a folder and a file in
-- it), desktop input outside lane 0, or an unbounded step beside anything else; a failed step and
-- STOP end the queued work of every lane; while one lane's uncertain step is checked, the other
-- lanes' running steps stay theirs; background app control is off until the person allows it.
-- Disposable database only; every account/device is synthetic.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.check(p_ok boolean, p_what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'lanes: %', p_what; END IF;
END $$;
CREATE FUNCTION pg_temp.fails(p_sql text, p_expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%' || p_expected || '%' THEN RETURN; END IF;
    RAISE EXCEPTION 'expected "%", got "%" for: %', p_expected, SQLERRM, p_sql;
  END;
  RAISE EXCEPTION 'expected "%", but statement succeeded: %', p_expected, p_sql;
END $$;
CREATE TEMP TABLE lane_ids AS SELECT gen_random_uuid() AS user_id, gen_random_uuid() AS conversation_id;
INSERT INTO auth.users (id, email) SELECT user_id, user_id::text || '@example.test' FROM lane_ids;
INSERT INTO public.ocade_conversations (id, user_id, title, surface)
SELECT conversation_id, user_id, 'Lanes fixture', 'jarvis' FROM lane_ids;
GRANT SELECT ON lane_ids TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_user uuid := (SELECT user_id FROM lane_ids);
  v_key text := repeat(replace(v_user::text, '-', ''), 4);
  v_device uuid;
  v_task record;
  v_state jsonb;
  v_deadline text := to_char((now() AT TIME ZONE 'UTC') + interval '5 minutes', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_seen text;
BEGIN
  PERFORM public.jarvis_enroll_device(v_key, 'Lanes fixture', 'windows', 'test', repeat('c', 64));
  v_device := public.jarvis_approve_device(v_user, public.jarvis_device_code(v_key));
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
  SELECT v_user, v_device, capability, true FROM unnest(ARRAY['master', 'files']) AS grants(capability);

  CREATE TEMP TABLE step (key text, path text, lane int) ON COMMIT DROP;
  CREATE FUNCTION pg_temp.batch(p_rows jsonb, p_deadline text) RETURNS jsonb LANGUAGE sql AS $f$
    SELECT jsonb_agg(jsonb_build_object('summary', 'Step ' || (r ->> 'key'), 'lane', (r ->> 'lane')::int,
             'action', jsonb_build_object('v', 1, 'key', r ->> 'key', 'operation', coalesce(r ->> 'op', 'fs.list'),
               'capability', 'files', 'risk', 'read',
               'arguments', jsonb_build_object('path', r ->> 'path'), 'deadlineUtc', p_deadline)))
      FROM jsonb_array_elements(p_rows) AS r;
  $f$;

  -- Resources are derived from the step, not taken from the caller.
  PERFORM pg_temp.check(public.jarvis_step_resources('{"operation":"fs.read_text","arguments":{"path":"Reports\\Q1.txt"}}')
                        = ARRAY['fs:/reports/q1.txt'], 'a path becomes one workspace key');
  PERFORM pg_temp.check(public.jarvis_step_resources('{"operation":"ui.invoke","arguments":{}}') = ARRAY['desktop'],
                        'app windows are desktop input');
  PERFORM pg_temp.check(public.jarvis_step_resources('{"operation":"shell.run","arguments":{}}') = ARRAY['*'],
                        'a command is unbounded');
  PERFORM pg_temp.check(public.jarvis_resources_conflict(ARRAY['fs:/a'], ARRAY['fs:/a/b.txt']), 'a folder holds its files');
  PERFORM pg_temp.check(public.jarvis_resources_conflict(ARRAY['fs:/'], ARRAY['fs:/x']), 'the workspace holds everything');
  PERFORM pg_temp.check(NOT public.jarvis_resources_conflict(ARRAY['fs:/a'], ARRAY['fs:/ab']), 'a sibling with a longer name is separate');
  PERFORM pg_temp.check(public.jarvis_resources_conflict(ARRAY['*'], ARRAY['web']), 'unbounded conflicts with everything');

  SELECT * INTO v_task FROM public.jarvis_open_task(v_user, (SELECT conversation_id FROM lane_ids), v_device,
                                                    'Lanes', NULL, '[]');
  -- A lane split that shares a resource is refused, whatever the caller claims.
  PERFORM pg_temp.fails(format('SELECT public.jarvis_queue_actions(%L, %L, %L)', v_task.task_id, v_task.controller,
    pg_temp.batch('[{"key":"x1","path":"a","lane":0},{"key":"x2","path":"a/b.txt","lane":1}]', v_deadline)), 'lane_conflict');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_queue_actions(%L, %L, %L)', v_task.task_id, v_task.controller,
    pg_temp.batch('[{"key":"x3","path":"a","lane":4}]', v_deadline)), 'invalid_lane');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_queue_actions(%L, %L, %L)', v_task.task_id, v_task.controller,
    pg_temp.batch('[{"key":"x4","path":"a","lane":2,"op":"ui.inspect"}]', v_deadline)), 'desktop_lane');
  PERFORM pg_temp.check(NOT EXISTS (SELECT 1 FROM public.jarvis_activity WHERE task_id = v_task.task_id),
                        'a refused split queued nothing');

  -- Two lanes: a1, a2 in lane 0 (same folder), b1 in lane 1.
  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller,
    pg_temp.batch('[{"key":"a1","path":"a","lane":0},{"key":"b1","path":"b","lane":1},{"key":"a2","path":"a/c.txt","lane":0}]', v_deadline));
  v_state := public.jarvis_claim_action(v_device);
  SELECT string_agg(e #>> '{intent,key}', ',' ORDER BY (e ->> 'lane')::int) INTO v_seen
    FROM jsonb_array_elements(v_state -> 'actions') AS e;
  PERFORM pg_temp.check(v_seen = 'a1,b1', 'each lane hands out its first step at once: ' || coalesce(v_seen, 'none'));
  PERFORM pg_temp.check(v_state #>> '{action,intent,key}' = 'a1', 'lane 0 first for a one-step companion');
  -- Claiming again hands out the same held steps, never a lane's second step early.
  v_state := public.jarvis_claim_action(v_device);
  PERFORM pg_temp.check(jsonb_array_length(v_state -> 'actions') = 2
                        AND NOT (v_state::text LIKE '%"a2"%'), 'a lane keeps its order');
  -- Lane 1 finishes; lane 0 is still at its first step.
  PERFORM public.jarvis_submit_receipt(v_device, (SELECT id FROM public.jarvis_activity WHERE task_id = v_task.task_id AND action ->> 'key' = 'b1'),
    jsonb_build_object('status', 'observed', 'maybeChanged', false, 'observedAtUtc', v_deadline, 'evidence', '{}'::jsonb));
  PERFORM public.jarvis_submit_receipt(v_device, (SELECT id FROM public.jarvis_activity WHERE task_id = v_task.task_id AND action ->> 'key' = 'a1'),
    jsonb_build_object('status', 'observed', 'maybeChanged', false, 'observedAtUtc', v_deadline, 'evidence', '{}'::jsonb));
  v_state := public.jarvis_claim_action(v_device);
  PERFORM pg_temp.check(v_state #>> '{actions,0,intent,key}' = 'a2' AND jsonb_array_length(v_state -> 'actions') = 1,
                        'the lane continues in order');
  -- 14D.3: while lane 0 still runs a2, a free agent is given independent work and starts at once;
  -- work on what lane 0 holds is refused.
  PERFORM pg_temp.fails(format('SELECT public.jarvis_queue_actions(%L, %L, %L)', v_task.task_id, v_task.controller,
    pg_temp.batch('[{"key":"c0","path":"a/c.txt","lane":2}]', v_deadline)), 'lane_conflict');
  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller,
    pg_temp.batch('[{"key":"c1","path":"c","lane":2}]', v_deadline));
  v_state := public.jarvis_claim_action(v_device);
  SELECT string_agg(e #>> '{intent,key}', ',' ORDER BY (e ->> 'lane')::int) INTO v_seen
    FROM jsonb_array_elements(v_state -> 'actions') AS e;
  PERFORM pg_temp.check(v_seen = 'a2,c1', 'a free agent joins while another still runs: ' || coalesce(v_seen, 'none'));
  PERFORM public.jarvis_stop_task(v_user, v_task.task_id);

  -- An uncertain step in one lane: the other lane's running step stays its own, nothing new starts.
  SELECT * INTO v_task FROM public.jarvis_open_task(v_user, (SELECT conversation_id FROM lane_ids), v_device,
                                                    'Lanes uncertain', NULL, '[]');
  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller,
    pg_temp.batch('[{"key":"u1","path":"u","lane":0},{"key":"v1","path":"v","lane":1},{"key":"v2","path":"v","lane":1}]', v_deadline));
  PERFORM public.jarvis_claim_action(v_device);
  PERFORM public.jarvis_submit_receipt(v_device, (SELECT id FROM public.jarvis_activity WHERE task_id = v_task.task_id AND action ->> 'key' = 'u1'),
    jsonb_build_object('status', 'unknown', 'maybeChanged', true, 'observedAtUtc', v_deadline, 'evidence', '{}'::jsonb));
  v_state := public.jarvis_claim_action(v_device);
  PERFORM pg_temp.check(v_state #>> '{task,status}' = 'waiting' AND jsonb_array_length(v_state -> 'actions') = 0,
                        'a waiting task hands out nothing new');
  PERFORM pg_temp.check(v_state -> 'running' = jsonb_build_array((SELECT id FROM public.jarvis_activity
                          WHERE task_id = v_task.task_id AND action ->> 'key' = 'v1')),
                        'the other lane''s running step stays its own');
  PERFORM pg_temp.check((SELECT status FROM public.jarvis_activity WHERE task_id = v_task.task_id AND action ->> 'key' = 'v2') = 'cancelled',
                        'the uncertain step ended the queued work of every lane');
  -- STOP ends every lane.
  PERFORM public.jarvis_stop_task(v_user, v_task.task_id);
  PERFORM pg_temp.check(NOT EXISTS (SELECT 1 FROM public.jarvis_activity WHERE task_id = v_task.task_id
                                      AND status IN ('queued', 'claimed', 'needs_confirmation')),
                        'STOP left a step in some lane');
  v_state := public.jarvis_claim_action(v_device);
  PERFORM pg_temp.check(v_state -> 'task' = 'null'::jsonb AND jsonb_array_length(v_state -> 'actions') = 0,
                        'nothing runs after STOP');
  -- Background app control is the person's own permission, off until turned on.
  PERFORM pg_temp.check(v_state -> 'backgroundAllowed' IS NULL OR NOT (v_state ->> 'backgroundAllowed')::boolean,
                        'background is off by default');
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed) VALUES (v_user, v_device, 'background', true);
  SELECT * INTO v_task FROM public.jarvis_open_task(v_user, (SELECT conversation_id FROM lane_ids), v_device,
                                                    'Lanes background', NULL, '[]');
  PERFORM public.jarvis_set_task_mode(v_user, v_task.task_id, 'background');  -- R12-01: both are needed
  PERFORM pg_temp.check((public.jarvis_claim_action(v_device) ->> 'backgroundAllowed')::boolean,
                        'a claim says when the person allows background app control');
  PERFORM public.jarvis_stop_task(v_user, v_task.task_id);
END;
$$;
ROLLBACK;
