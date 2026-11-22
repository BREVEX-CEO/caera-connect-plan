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
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%' || p_expected || '%' THEN RETURN; END IF;
    RAISE EXCEPTION 'expected "%", got "%" for: %', p_expected, SQLERRM, p_sql;
  END;
  RAISE EXCEPTION 'expected "%", but statement succeeded: %', p_expected, p_sql;
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
  first_lease uuid;
  task_id uuid;
  due timestamptz := now() + interval '30 seconds';
  claimed record;
  reminder record;
  run record;
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
  SELECT c.claim_token INTO STRICT first_lease
    FROM public.jarvis_claim_due_schedules(due + interval '1 second', 10) AS c WHERE c.id = s;
  PERFORM pg_temp.check((SELECT claimed_occurrence = due FROM public.jarvis_schedules WHERE id = once),
    'both due schedules claimed');
  SELECT count(*) INTO n FROM public.jarvis_claim_due_schedules(due + interval '2 seconds', 10);
  PERFORM pg_temp.check(n = 0, 'an occurrence was claimed twice');

  -- A claim left by a run that died is taken again after ten minutes, same occurrence.
  SELECT * INTO claimed FROM public.jarvis_claim_due_schedules(due + interval '11 minutes', 10) WHERE id = s;
  PERFORM pg_temp.check(claimed.occurrence = due AND claimed.claim_token <> first_lease,
    'a stale claim kept its occurrence and received a new lease');
  PERFORM pg_temp.check(NOT EXISTS (SELECT FROM public.jarvis_run_schedule(a, s, due, first_lease, 'fixture-v1')),
    'a reclaimed, stale lease could still start work');
  PERFORM pg_temp.check(NOT EXISTS (SELECT FROM public.jarvis_run_schedule(
    'b5b5b5b5-0000-4000-8000-000000000002', s, due, claimed.claim_token, 'fixture-v1')),
    'another user ran an occurrence');
  PERFORM pg_temp.fails(format('SELECT * FROM public.jarvis_run_schedule(%L, %L, %L, %L, %L)',
    a, s, due, claimed.claim_token, 'fixture-v1'), 'online_not_consented');
  UPDATE public.profiles SET online_ai_consent_at = now(), online_ai_consent_version = 'fixture-v1'
   WHERE id = a;
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed) VALUES
    (a, NULL, 'master', true), (a, dev_a, 'files', true)
  ON CONFLICT DO NOTHING;

  -- A manually started task is never adopted, even with an identical objective.
  SELECT * INTO STRICT run FROM public.jarvis_open_task(a, conv, dev_a, claimed.what, NULL, '[]');
  PERFORM pg_temp.fails(format('SELECT * FROM public.jarvis_run_schedule(%L, %L, %L, %L, %L)',
    a, s, due, claimed.claim_token, 'fixture-v1'), 'busy');
  PERFORM pg_temp.check((SELECT t.schedule_occurrence IS NULL FROM public.jarvis_tasks AS t WHERE t.id = run.task_id),
    'a manual task received the schedule key');
  PERFORM public.jarvis_stop_task(a, run.task_id);

  -- Admission and deduplication commit together, before any worker can plan.
  SELECT * INTO STRICT run FROM public.jarvis_run_schedule(a, s, due, claimed.claim_token, 'fixture-v1');
  task_id := run.task_id;
  PERFORM pg_temp.check(run.wake_needed AND
    (SELECT t.schedule_occurrence = claimed.occurrence_key FROM public.jarvis_tasks AS t WHERE t.id = run.task_id),
    'an admitted task was not atomically linked');
  SELECT * INTO STRICT run FROM public.jarvis_run_schedule(a, s, due, claimed.claim_token, 'fixture-v1');
  PERFORM pg_temp.check(run.task_id = task_id AND run.wake_needed, 'an unopened worker resumes the same task');
  PERFORM public.jarvis_stop_task(a, task_id);
  SELECT * INTO STRICT run FROM public.jarvis_run_schedule(a, s, due, claimed.claim_token, 'fixture-v1');
  PERFORM pg_temp.check(run.task_id = task_id AND NOT run.wake_needed, 'retry reopened a settled task');

  -- Only that occurrence's claim finishes it.
  PERFORM pg_temp.check(NOT public.jarvis_finish_schedule(s, due - interval '1 day', claimed.claim_token,
    due + interval '1 day', 'x'),
    'a different occurrence finished the claim');
  PERFORM pg_temp.check(NOT public.jarvis_finish_schedule(s, due, first_lease, due + interval '1 day', 'x'),
    'a reclaimed lease finished the current run');
  PERFORM pg_temp.check(public.jarvis_finish_schedule(s, due, claimed.claim_token,
    due + interval '1 day', 'Task started'),
    'the claim finished');
  PERFORM pg_temp.check((SELECT next_at = due + interval '1 day' AND active AND claimed_at IS NULL
                           AND last_outcome = 'Task started' FROM public.jarvis_schedules WHERE id = s),
    'a repeat moves to its next run');
  PERFORM pg_temp.check(NOT public.jarvis_finish_schedule(s, due, claimed.claim_token, due + interval '2 days', 'again'),
    'a finished occurrence finished twice');

  -- A one-time schedule ends.
  SELECT os.claim_token INTO STRICT reminder FROM public.jarvis_schedules AS os WHERE os.id = once;
  SELECT * INTO STRICT run FROM public.jarvis_run_schedule(a, once, due, reminder.claim_token, 'fixture-v1');
  PERFORM pg_temp.check(run.task_id IS NULL, 'a reminder created a task');
  PERFORM public.jarvis_run_schedule(a, once, due, reminder.claim_token, 'fixture-v1');
  PERFORM pg_temp.check((SELECT count(*) = 1 FROM public.ocade_messages
    WHERE user_id = a AND content = 'Reminder: Call the bank'), 'the reminder was not written exactly once');
  PERFORM pg_temp.check(public.jarvis_finish_schedule(once, due, reminder.claim_token, NULL, 'Reminder sent'),
    'one-time finished');
  PERFORM pg_temp.check((SELECT NOT active FROM public.jarvis_schedules WHERE id = once), 'one-time ended');

  -- Pause stops claims; resume takes the next run given.
  SELECT * INTO STRICT claimed
    FROM public.jarvis_claim_due_schedules(due + interval '1 day', 10) AS c WHERE c.id = s;
  SELECT * INTO STRICT run FROM public.jarvis_run_schedule(a, s, claimed.occurrence, claimed.claim_token, 'fixture-v1');
  PERFORM pg_temp.check(run.task_id <> task_id AND run.wake_needed, 'a second cycle did not get its own task');
  PERFORM public.jarvis_stop_task(a, run.task_id);
  PERFORM pg_temp.check(public.jarvis_set_schedule_active(a, s, false, NULL), 'paused');
  PERFORM pg_temp.check(NOT EXISTS (
    SELECT FROM public.jarvis_run_schedule(a, s, claimed.occurrence, claimed.claim_token, 'fixture-v1')
  ), 'a paused claim still ran');
  PERFORM pg_temp.check(NOT public.jarvis_finish_schedule(s, claimed.occurrence, claimed.claim_token, NULL, 'x'),
    'a paused claim still finished');
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
-- Outcome Autopilot (plan 28.1.2): a goal states when it stops. A person cannot set it directly;
-- a count ends the schedule on its last run; an end date ends it instead of claiming a later run.
DO $$
BEGIN
  PERFORM public.jarvis_set_schedule_goal('a5a5a5a5-0000-4000-8000-000000000001',
    (SELECT id FROM ids WHERE name = 's'), NULL, 2);
  RAISE EXCEPTION 'schedules: a person set a stop condition directly';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  a uuid := 'a5a5a5a5-0000-4000-8000-000000000001';
  conv uuid := 'a5a5a5a5-1111-4000-8000-000000000001';
  due timestamptz := now() + interval '30 seconds';
  counted uuid;
  dated uuid;
  c record;
BEGIN
  counted := public.jarvis_save_schedule(a, NULL, conv, NULL, 'Chase invoices', due, 'daily', 'UTC');
  dated := public.jarvis_save_schedule(a, NULL, conv, NULL, 'Renewal papers', due, 'daily', 'UTC');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_set_schedule_goal(%L, %L, now() - interval ''1 day'', NULL)',
    a, dated), 'schedule_end_in_past');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_set_schedule_goal(%L, %L, NULL, 0)', a, counted),
    'jarvis_schedules_max_runs_check');
  PERFORM pg_temp.check(NOT public.jarvis_set_schedule_goal('b5b5b5b5-0000-4000-8000-000000000002', counted, NULL, 2),
    'another person set a stop condition');
  PERFORM pg_temp.check(public.jarvis_set_schedule_goal(a, counted, NULL, 2), 'count set');
  PERFORM pg_temp.check(public.jarvis_set_schedule_goal(a, dated, due + interval '12 hours', NULL), 'end date set');

  -- First run of each: the counted one keeps going; the dated one's next run falls after its end.
  FOR c IN SELECT * FROM public.jarvis_claim_due_schedules(due + interval '1 second', 10)
            WHERE id IN (counted, dated) LOOP
    PERFORM pg_temp.check(public.jarvis_finish_schedule(c.id, c.occurrence, c.claim_token,
      c.occurrence + interval '1 day', 'Reminder sent'), 'run finished');
  END LOOP;
  PERFORM pg_temp.check((SELECT active AND runs_done = 1 FROM public.jarvis_schedules WHERE id = counted),
    'a counted goal stopped before its count');
  PERFORM pg_temp.check((SELECT NOT active FROM public.jarvis_schedules WHERE id = dated),
    'a goal ran on past its end date');

  -- Second run reaches the count and ends it.
  SELECT * INTO STRICT c FROM public.jarvis_claim_due_schedules(due + interval '1 day 1 second', 10)
   WHERE id = counted;
  PERFORM pg_temp.check(public.jarvis_finish_schedule(c.id, c.occurrence, c.claim_token,
    c.occurrence + interval '1 day', 'Reminder sent'), 'second run finished');
  PERFORM pg_temp.check((SELECT NOT active AND runs_done = 2 FROM public.jarvis_schedules WHERE id = counted),
    'a counted goal became perpetual');

  -- An end date moved before a waiting run ends the schedule at its time, without claiming it.
  UPDATE public.jarvis_schedules SET active = true, next_at = due + interval '3 days',
         run_until = due + interval '2 days' WHERE id = dated;
  PERFORM pg_temp.check(NOT EXISTS (SELECT FROM public.jarvis_claim_due_schedules(due + interval '4 days', 10)
                                     WHERE id = dated), 'a run after the end date was claimed');
  PERFORM pg_temp.check((SELECT NOT active AND last_outcome = 'Ended on its end date'
                           FROM public.jarvis_schedules WHERE id = dated), 'an ended goal stayed active');
END $$;
ROLLBACK;
