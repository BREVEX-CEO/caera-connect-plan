-- Scheduled JARVIS work (REPO-60/70): only the person's own JARVIS conversation and unrevoked
-- computer can be scheduled; a person cannot call the server steps; a due occurrence is claimed
-- exactly once, a stale claim is taken again, only that occurrence's claim finishes it; a one-time
-- schedule ends; pause stops claims and resume takes the next run; another person cannot read or
-- remove the schedule. Disposable database only.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;

CREATE FUNCTION pg_temp.fails(p_sql text, p_expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'expected failure "%" but it succeeded: %', p_expected, p_sql;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%' || p_expected || '%' THEN
    RAISE EXCEPTION 'expected "%", got "%" for: %', p_expected, SQLERRM, p_sql;
  END IF;
END $$;
CREATE FUNCTION pg_temp.check(p_ok boolean, p_what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'schedules: %', p_what; END IF;
END $$;

INSERT INTO auth.users (id, email) VALUES
  ('a5a5a5a5-0000-4000-8000-000000000001', 'sched-a@example.test'),
  ('b5b5b5b5-0000-4000-8000-000000000002', 'sched-b@example.test');
INSERT INTO public.ocade_conversations (id, user_id, title, surface) VALUES
  ('a5a5a5a5-1111-4000-8000-000000000001', 'a5a5a5a5-0000-4000-8000-000000000001', 'J', 'jarvis'),
  ('a5a5a5a5-1111-4000-8000-000000000002', 'a5a5a5a5-0000-4000-8000-000000000001', 'C', 'chat'),
  ('b5b5b5b5-1111-4000-8000-000000000001', 'b5b5b5b5-0000-4000-8000-000000000002', 'J', 'jarvis');

CREATE TEMP TABLE ids (name text PRIMARY KEY, id uuid);
GRANT ALL ON ids TO service_role, authenticated;

SET LOCAL ROLE service_role;
DO $$
DECLARE
  v record;
BEGIN
  SELECT * INTO v FROM public.jarvis_enroll_device(repeat('S', 120), 'PC S', 'windows', '0.1.0', repeat('7', 64));
  INSERT INTO ids VALUES ('dev_a', public.jarvis_approve_device('a5a5a5a5-0000-4000-8000-000000000001', v.code));
  SELECT * INTO v FROM public.jarvis_enroll_device(repeat('T', 120), 'PC T', 'windows', '0.1.0', repeat('8', 64));
  INSERT INTO ids VALUES ('dev_b', public.jarvis_approve_device('b5b5b5b5-0000-4000-8000-000000000002', v.code));
END $$;

DO $$
DECLARE
  a uuid := 'a5a5a5a5-0000-4000-8000-000000000001';
  conv uuid := 'a5a5a5a5-1111-4000-8000-000000000001';
  dev_a uuid := (SELECT id FROM ids WHERE name = 'dev_a');
  dev_b uuid := (SELECT id FROM ids WHERE name = 'dev_b');
  s uuid;
  once uuid;
  due timestamptz := now() + interval '30 seconds';
  claimed record;
  n integer;
BEGIN
  -- Only the person's own JARVIS conversation and their own unrevoked computer.
  PERFORM pg_temp.fails(format('SELECT public.jarvis_save_schedule(%L, NULL, %L, NULL, %L, now(), %L, %L)',
    a, 'a5a5a5a5-1111-4000-8000-000000000002', 'x', 'none', 'UTC'), 'schedule_conversation_unavailable');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_save_schedule(%L, NULL, %L, NULL, %L, now(), %L, %L)',
    a, 'b5b5b5b5-1111-4000-8000-000000000001', 'x', 'none', 'UTC'), 'schedule_conversation_unavailable');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_save_schedule(%L, NULL, %L, %L, %L, now(), %L, %L)',
    a, conv, dev_b, 'x', 'none', 'UTC'), 'schedule_device_unavailable');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_save_schedule(%L, NULL, %L, NULL, %L, now() - interval ''1 hour'', %L, %L)',
    a, conv, 'x', 'none', 'UTC'), 'schedule_in_past');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_save_schedule(%L, NULL, %L, NULL, %L, now(), %L, %L)',
    a, conv, 'x', 'hourly', 'UTC'), 'jarvis_schedules_repeat_check');

  s := public.jarvis_save_schedule(a, NULL, conv, dev_a, 'Tidy the downloads folder', due, 'daily', 'Asia/Kolkata');
  once := public.jarvis_save_schedule(a, NULL, conv, NULL, 'Call the bank', due, 'none', 'UTC');
  INSERT INTO ids VALUES ('s', s), ('once', once);

  -- Nothing is due yet.
  SELECT count(*) INTO n FROM public.jarvis_claim_due_schedules(now(), 10);
  PERFORM pg_temp.check(n = 0, 'claimed before it was due');

  -- Due: both claimed once; a second claim in the same minute finds nothing.
  SELECT count(*) INTO n FROM public.jarvis_claim_due_schedules(due + interval '1 second', 10);
  PERFORM pg_temp.check(n = 2, 'both due schedules claimed');
  SELECT count(*) INTO n FROM public.jarvis_claim_due_schedules(due + interval '2 seconds', 10);
  PERFORM pg_temp.check(n = 0, 'an occurrence was claimed twice');

  -- A claim left by a run that died is taken again after ten minutes, same occurrence.
  SELECT * INTO claimed FROM public.jarvis_claim_due_schedules(due + interval '11 minutes', 10) WHERE id = s;
  PERFORM pg_temp.check(claimed.occurrence = due, 'a stale claim kept its occurrence');

  -- Only that occurrence's claim finishes it.
  PERFORM pg_temp.check(NOT public.jarvis_finish_schedule(s, due - interval '1 day', due + interval '1 day', 'x'),
    'a different occurrence finished the claim');
  PERFORM pg_temp.check(public.jarvis_finish_schedule(s, due, due + interval '1 day', 'Task started'),
    'the claim finished');
  PERFORM pg_temp.check((SELECT next_at = due + interval '1 day' AND active AND claimed_at IS NULL
                           AND last_outcome = 'Task started' FROM public.jarvis_schedules WHERE id = s),
    'a repeat moves to its next run');
  PERFORM pg_temp.check(NOT public.jarvis_finish_schedule(s, due, due + interval '2 days', 'again'),
    'a finished occurrence finished twice');

  -- A one-time schedule ends.
  PERFORM pg_temp.check(public.jarvis_finish_schedule(once, due, NULL, 'Reminder sent'), 'one-time finished');
  PERFORM pg_temp.check((SELECT NOT active FROM public.jarvis_schedules WHERE id = once), 'one-time ended');

  -- Pause stops claims; resume takes the next run given.
  PERFORM pg_temp.check(public.jarvis_set_schedule_active(a, s, false, NULL), 'paused');
  SELECT count(*) INTO n FROM public.jarvis_claim_due_schedules(due + interval '3 days', 10);
  PERFORM pg_temp.check(n = 0, 'a paused schedule was claimed');
  PERFORM pg_temp.check(public.jarvis_set_schedule_active(a, s, true, due + interval '4 days'), 'resumed');
  PERFORM pg_temp.check((SELECT active AND next_at = due + interval '4 days' FROM public.jarvis_schedules WHERE id = s),
    'resume took the next run');
  -- Another person cannot pause or edit it.
  PERFORM pg_temp.check(NOT public.jarvis_set_schedule_active('b5b5b5b5-0000-4000-8000-000000000002', s, false, NULL),
    'another person paused it');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_save_schedule(%L, %L, %L, NULL, %L, now() + interval ''1 hour'', %L, %L)',
    'b5b5b5b5-0000-4000-8000-000000000002', s, 'b5b5b5b5-1111-4000-8000-000000000001', 'hijack', 'none', 'UTC'),
    'schedule_not_found');
END $$;

-- A signed-in person reads only their own schedules and cannot call the server steps.
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"sub": "b5b5b5b5-0000-4000-8000-000000000002", "role": "authenticated"}', true); END $$;
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public.jarvis_schedules;
  PERFORM pg_temp.check(n = 0, 'another person read the schedules');
  DELETE FROM public.jarvis_schedules WHERE id = (SELECT id FROM ids WHERE name = 's');
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.check(n = 0, 'another person removed a schedule');
  BEGIN
    PERFORM public.jarvis_claim_due_schedules(now(), 10);
    RAISE EXCEPTION 'schedules: a person claimed occurrences';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"sub": "a5a5a5a5-0000-4000-8000-000000000001", "role": "authenticated"}', true); END $$;
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public.jarvis_schedules;
  PERFORM pg_temp.check(n = 2, 'the owner sees their schedules');
  DELETE FROM public.jarvis_schedules WHERE id = (SELECT id FROM ids WHERE name = 'once');
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.check(n = 1, 'the owner removed their schedule');
END $$;
ROLLBACK;
