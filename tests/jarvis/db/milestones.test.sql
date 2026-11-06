-- C2 authority contract: per-phase proof/budget, durable resume and STOP fences.
-- Synthetic rows and receipts only; no customer operation is executed.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.milestone_assert(p_ok boolean, p_what text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'milestone contract: %', p_what; END IF;
END;
$$;
CREATE FUNCTION pg_temp.milestone_fails(p_sql text, p_expected text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF position(p_expected IN SQLERRM) = 0 THEN RAISE; END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'statement succeeded; expected %', p_expected;
END;
$$;
CREATE FUNCTION pg_temp.milestone_action(p_key text, p_index integer, p_checks jsonb)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_array(jsonb_build_object('summary', 'Independent fixture check',
    'milestone', p_index, 'action', jsonb_build_object('key', p_key, 'operation', 'verify.checks',
      'capability', 'files', 'risk', 'read', 'arguments', jsonb_build_object('checks', p_checks))));
$$;
CREATE TEMP TABLE milestone_ids AS
SELECT gen_random_uuid() AS user_id, gen_random_uuid() AS conversation_id;
INSERT INTO auth.users (id, email) SELECT user_id, user_id::text || '@example.test' FROM milestone_ids;
INSERT INTO public.ocade_conversations (id, user_id, title, surface)
SELECT conversation_id, user_id, 'Milestone fixture', 'jarvis' FROM milestone_ids;
GRANT SELECT ON milestone_ids TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  u uuid := (SELECT user_id FROM milestone_ids);
  c uuid := (SELECT conversation_id FROM milestone_ids);
  k text := repeat(replace(u::text, '-', ''), 4);
  device uuid;
  task record;
  controller uuid;
  activity uuid;
  first_check jsonb := '[{"id":"first","kind":"file_exists","description":"First output","params":{"path":"OCADE output/first.txt"}}]';
  second_check jsonb := '[{"id":"second","kind":"file_exists","description":"Second output","params":{"path":"OCADE output/second.txt"}}]';
  checks jsonb;
  plan jsonb := '[{"description":"First stage","checks":["first"],"stepBudget":1},
                  {"description":"Second stage","checks":["second"],"stepBudget":2}]';
  receipt jsonb := '{"status":"observed","maybeChanged":false,"observedAtUtc":"2026-11-05T00:00:00.000Z","evidence":{"predicates":{"first":true}}}';
  view jsonb;
  poll jsonb;
  job_id text := '1234abcd1234abcd';
BEGIN
  checks := first_check || second_check;
  PERFORM pg_temp.milestone_assert(
    NOT has_function_privilege('anon', 'public.jarvis_complete_milestone(uuid,uuid,integer)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.jarvis_complete_milestone(uuid,uuid,integer)', 'EXECUTE'),
    'only the server may advance a milestone');
  PERFORM public.jarvis_enroll_device(k, 'Milestone fixture', 'windows', 'test', repeat('e', 64));
  device := public.jarvis_approve_device(u, public.jarvis_device_code(k));
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
  SELECT u, device, capability, true FROM unnest(ARRAY['master', 'files', 'computer_control']) AS grants(capability);
  SELECT * INTO task FROM public.jarvis_open_task(u, c, device, 'Milestone fixture', NULL, '[]');
  controller := task.controller;
  PERFORM pg_temp.milestone_fails(format('SELECT public.jarvis_set_outcome(%L,%L,%L,%L)',
    task.task_id, controller, checks,
    '[{"description":"Incomplete","checks":["first"],"stepBudget":1}]'), 'invalid_milestone_plan');
  PERFORM public.jarvis_set_outcome(task.task_id, controller, checks, plan);
  view := public.jarvis_task_state(task.task_id);
  PERFORM pg_temp.milestone_assert(view -> 'plan' = plan AND view #>> '{checkpoint,milestones,index}' = '0',
    'plan and cursor are stored in task state');
  PERFORM pg_temp.milestone_fails(format('UPDATE public.jarvis_tasks SET plan=%L WHERE id=%L',
    '[]', task.task_id), 'milestone_plan_fixed');
  PERFORM pg_temp.milestone_fails(format('SELECT public.jarvis_complete_milestone(%L,%L,0)',
    task.task_id, gen_random_uuid()), 'stale_controller');
  PERFORM pg_temp.milestone_fails(format('SELECT public.jarvis_complete_milestone(%L,%L,0)',
    task.task_id, controller), 'milestone_unverified');

  PERFORM public.jarvis_queue_actions(task.task_id, controller,
    pg_temp.milestone_action('first-proof', 0, first_check));
  PERFORM pg_temp.milestone_fails(format('SELECT public.jarvis_complete_milestone(%L,%L,0)',
    task.task_id, controller), 'actions_open');
  activity := (public.jarvis_claim_action(device) -> 'action' ->> 'id')::uuid;
  PERFORM public.jarvis_submit_receipt(device, activity, receipt);
  UPDATE public.jarvis_permissions SET allowed = false WHERE user_id = u AND device_id = device AND capability = 'files';
  PERFORM pg_temp.milestone_fails(format('SELECT public.jarvis_complete_milestone(%L,%L,0)',
    task.task_id, controller), 'milestone_unverified');
  UPDATE public.jarvis_permissions SET allowed = true WHERE user_id = u AND device_id = device AND capability = 'files';
  PERFORM pg_temp.milestone_assert(public.jarvis_complete_milestone(task.task_id, controller, 0) = 1,
    'independent proof advances only one phase');
  PERFORM pg_temp.milestone_fails(format('SELECT public.jarvis_complete_milestone(%L,%L,0)',
    task.task_id, controller), 'milestone_changed');
  PERFORM pg_temp.milestone_fails(format('SELECT public.jarvis_queue_actions(%L,%L,%L)',
    task.task_id, controller, pg_temp.milestone_action('stale-phase', 0, first_check)), 'milestone_changed');
  PERFORM pg_temp.milestone_fails(format('SELECT public.jarvis_queue_actions(%L,%L,%L)',
    task.task_id, controller,
    pg_temp.milestone_action('too-many-1', 1, second_check) ||
    pg_temp.milestone_action('too-many-2', 1, second_check) ||
    pg_temp.milestone_action('too-many-3', 1, second_check)), 'milestone_budget_exhausted');
  PERFORM pg_temp.milestone_assert((SELECT count(*) = 1 FROM public.jarvis_activity
    WHERE task_id = task.task_id AND action IS NOT NULL), 'over-budget batches queue nothing');

  PERFORM public.jarvis_take_over(u, task.task_id);
  controller := public.jarvis_resume_task(u, task.task_id);
  view := public.jarvis_task_state(task.task_id);
  PERFORM pg_temp.milestone_assert(view #>> '{checkpoint,milestones,index}' = '1'
    AND view #>> '{checkpoint,milestones,startStep}' = '1', 'resume preserves verified work and phase budget');

  PERFORM public.jarvis_queue_actions(task.task_id, controller,
    pg_temp.milestone_action('second-failed', 1, second_check));
  activity := (public.jarvis_claim_action(device) -> 'action' ->> 'id')::uuid;
  PERFORM public.jarvis_submit_receipt(device, activity,
    jsonb_set(receipt, '{evidence,predicates}', '{"second":false}'));
  PERFORM pg_temp.milestone_fails(format('SELECT public.jarvis_complete_milestone(%L,%L,1)',
    task.task_id, controller), 'milestone_unverified');
  PERFORM public.jarvis_queue_actions(task.task_id, controller,
    pg_temp.milestone_action('second-proof', 1, second_check));
  activity := (public.jarvis_claim_action(device) -> 'action' ->> 'id')::uuid;
  PERFORM public.jarvis_submit_receipt(device, activity,
    jsonb_set(receipt, '{evidence,predicates}', '{"second":true}'));
  PERFORM pg_temp.milestone_assert(public.jarvis_complete_milestone(task.task_id, controller, 1) = 2,
    'the second phase has its own proof and budget');
  PERFORM pg_temp.milestone_assert((public.jarvis_task_state(task.task_id) ->> 'status') = 'running',
    'individual milestone passes never declare the task completed');

  PERFORM public.jarvis_queue_actions(task.task_id, controller,
    pg_temp.milestone_action('all-proof', 2, checks));
  activity := (public.jarvis_claim_action(device) -> 'action' ->> 'id')::uuid;
  PERFORM public.jarvis_submit_receipt(device, activity,
    jsonb_set(receipt, '{evidence,predicates}', '{"first":true,"second":true}'));
  PERFORM pg_temp.milestone_assert(public.jarvis_settle_task(task.task_id, controller,
    '{"passed":["first","second"],"failed":[],"unverified":[]}', 'Fixture complete') = 'completed',
    'final settlement still needs every immutable check');
  view := public.jarvis_task_state(task.task_id);
  PERFORM pg_temp.milestone_assert(jsonb_array_length(view #> '{checkpoint,milestones,verified}') = 2,
    'settlement retains milestone history');

  SELECT * INTO task FROM public.jarvis_open_task(u, c, device, 'Tracked job fixture', NULL, '[]');
  controller := task.controller;
  PERFORM public.jarvis_set_outcome(task.task_id, controller, first_check,
    '[{"description":"Finish command","checks":["first"],"stepBudget":2}]');
  poll := jsonb_build_array(jsonb_build_object('summary', 'Observe command', 'milestone', 0,
    'action', jsonb_build_object('key', 'job-poll:' || job_id || ':1', 'operation', 'job.status',
      'capability', 'computer_control', 'risk', 'read', 'arguments', jsonb_build_object('jobId', job_id))));
  PERFORM pg_temp.milestone_fails(format('SELECT public.jarvis_queue_actions(%L,%L,%L)',
    task.task_id, controller, poll), 'invalid_job_poll');
  PERFORM public.jarvis_queue_actions(task.task_id, controller,
    '[{"summary":"Confirmed fixture command","action":{"key":"job","operation":"job.start",
       "capability":"computer_control","risk":"external_effect","arguments":{"command":"fixture","timeoutSeconds":3600}}}]');
  SELECT a.id INTO activity FROM public.jarvis_activity AS a
   WHERE a.task_id = task.task_id AND a.action ->> 'key' = 'job';
  PERFORM public.jarvis_confirm_action(u, activity);
  activity := (public.jarvis_claim_action(device) -> 'action' ->> 'id')::uuid;
  PERFORM public.jarvis_submit_receipt(device, activity, receipt ||
    jsonb_build_object('maybeChanged', true, 'evidence', jsonb_build_object('jobId', job_id, 'state', 'running')));
  FOR n IN 2..36 LOOP
    poll := jsonb_set(poll, '{0,action,key}', to_jsonb('job-poll:' || job_id || ':' || n::text));
    PERFORM pg_temp.milestone_assert(public.jarvis_queue_actions(task.task_id, controller, poll) = 1,
      'job reads do not consume the remaining milestone action');
    PERFORM pg_temp.milestone_assert(public.jarvis_queue_actions(task.task_id, controller, poll) = 0,
      'retrying the same poll does not insert another action');
    activity := (public.jarvis_claim_action(device) -> 'action' ->> 'id')::uuid;
    PERFORM public.jarvis_submit_receipt(device, activity,
      receipt || jsonb_build_object('evidence', jsonb_build_object('jobId', job_id,
        'state', CASE WHEN n = 36 THEN 'finished' ELSE 'running' END, 'exitCode', 0)));
  END LOOP;
  PERFORM pg_temp.milestone_assert(public.jarvis_queue_actions(task.task_id, controller,
    pg_temp.milestone_action('after-job', 0, first_check)) = 1,
    'the remaining milestone action is available after many polls');
  PERFORM pg_temp.milestone_fails(format('SELECT public.jarvis_queue_actions(%L,%L,%L)',
    task.task_id, controller, pg_temp.milestone_action('one-too-many', 0, first_check)),
    'milestone_budget_exhausted');
  PERFORM public.jarvis_stop_task(u, task.task_id);

  SELECT * INTO task FROM public.jarvis_open_task(u, c, device, 'STOP milestone fixture', NULL, '[]');
  controller := task.controller;
  PERFORM public.jarvis_set_outcome(task.task_id, controller, checks, plan);
  PERFORM public.jarvis_stop_task(u, task.task_id);
  PERFORM pg_temp.milestone_fails(format('SELECT public.jarvis_complete_milestone(%L,%L,0)',
    task.task_id, controller), 'stale_controller');
  PERFORM pg_temp.milestone_fails(format('SELECT public.jarvis_queue_actions(%L,%L,%L)',
    task.task_id, controller, pg_temp.milestone_action('after-stop', 0, first_check)), 'stale_controller');
END;
$$;
ROLLBACK;
