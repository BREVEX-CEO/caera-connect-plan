-- JARVIS task authority contract tests (plan.md P02/P03, §28.2).
-- Runs in a disposable database built by run.sh; every block raises on failure.
\set ON_ERROR_STOP on
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
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'check failed: %', p_what; END IF;
END $$;

CREATE FUNCTION pg_temp.act(p_key text, p_risk text DEFAULT 'reversible_write', p_cap text DEFAULT 'files')
RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_array(jsonb_build_object('summary', 'Step ' || p_key, 'action',
    jsonb_build_object('key', p_key, 'capability', p_cap, 'risk', p_risk, 'operation', 'office.inspect_workbook')));
$$;

-- Fixtures: account A with a JARVIS conversation, a Chat conversation and an approved device;
-- account B with its own device.
INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@example.test');
INSERT INTO public.ocade_conversations (id, user_id, title, surface) VALUES
  ('aaaaaaaa-1111-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'J', 'jarvis'),
  ('aaaaaaaa-1111-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'C', 'chat'),
  ('aaaaaaaa-1111-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'J2', 'jarvis'),
  ('bbbbbbbb-1111-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'J', 'jarvis');

SET ROLE service_role;

-- Enrollment and approval by the code the device shows.
CREATE TEMP TABLE ids (name text PRIMARY KEY, id uuid);
GRANT ALL ON ids TO service_role;
DO $$
DECLARE
  v record;
  key_a text := repeat('A', 120);
  key_b text := repeat('B', 120);
BEGIN
  SELECT * INTO v FROM public.jarvis_enroll_device(key_a, 'PC A', 'windows', '0.1.0', repeat('0', 64));
  PERFORM pg_temp.check(v.code = public.jarvis_device_code(key_a) AND length(v.code) = 16, 'code shape');
  PERFORM pg_temp.fails($q$SELECT public.jarvis_approve_device('aaaaaaaa-0000-0000-0000-000000000001', '0000000000000000')$q$, 'unknown_code');
  INSERT INTO ids VALUES ('dev_a', public.jarvis_approve_device('aaaaaaaa-0000-0000-0000-000000000001', lower(v.code)));
  PERFORM pg_temp.check((SELECT id FROM ids WHERE name = 'dev_a') = v.device_id, 'approved the enrolled device');
  -- A code is one-use.
  PERFORM pg_temp.fails(format('SELECT public.jarvis_approve_device(%L, %L)', 'bbbbbbbb-0000-0000-0000-000000000002', v.code), 'unknown_code');

  SELECT * INTO v FROM public.jarvis_enroll_device(key_b, 'PC B', 'windows', '0.1.0', repeat('1', 64));
  INSERT INTO ids VALUES ('dev_b', public.jarvis_approve_device('bbbbbbbb-0000-0000-0000-000000000002', v.code));

  -- An expired enrollment cannot be approved.
  SELECT * INTO v FROM public.jarvis_enroll_device(repeat('C', 120), 'Late', 'windows', '0.1.0', repeat('2', 64));
  UPDATE public.jarvis_devices SET enrollment_expires_at = now() - interval '1 second' WHERE id = v.device_id;
  PERFORM pg_temp.fails(format('SELECT public.jarvis_approve_device(%L, %L)', 'aaaaaaaa-0000-0000-0000-000000000001', v.code), 'unknown_code');

  -- Five pending enrollments per source, then refusal.
  FOR i IN 1..5 LOOP
    PERFORM public.jarvis_enroll_device(repeat(chr(68 + i), 120), 'Flood', NULL, NULL, repeat('3', 64));
  END LOOP;
  PERFORM pg_temp.fails($q$SELECT public.jarvis_enroll_device(repeat('Z', 120), 'Flood', NULL, NULL, repeat('3', 64))$q$, 'too_many_enrollments');
END $$;

-- Replay: a signed request's timestamp is accepted once and must increase.
DO $$
DECLARE
  dev uuid := (SELECT id FROM ids WHERE name = 'dev_a');
BEGIN
  PERFORM pg_temp.check(public.jarvis_device_seen(dev, 1000), 'first request accepted');
  PERFORM pg_temp.check(NOT public.jarvis_device_seen(dev, 1000), 'same timestamp replay refused');
  PERFORM pg_temp.check(NOT public.jarvis_device_seen(dev, 999), 'older timestamp refused');
  PERFORM pg_temp.check(public.jarvis_device_seen(dev, 1001), 'newer timestamp accepted');
END $$;

-- Opening a task: wrong surface, wrong account, missing permission, pause, idempotent Send.
DO $$
DECLARE
  a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  dev_a uuid := (SELECT id FROM ids WHERE name = 'dev_a');
  dev_b uuid := (SELECT id FROM ids WHERE name = 'dev_b');
  first record;
  again record;
  outcome jsonb := '[{"id": "totals_reconcile"}, {"id": "report_pdf_renders"}]';
BEGIN
  PERFORM pg_temp.fails(format('SELECT * FROM public.jarvis_open_task(%L, %L, %L, %L, %L, %L)',
    a, dev_a, dev_a, 'T', outcome, '[]'), 'conversation_not_found');
  PERFORM pg_temp.fails(format('SELECT * FROM public.jarvis_open_task(%L, %L, %L, %L, %L, %L)',
    a, 'aaaaaaaa-1111-0000-0000-000000000002', dev_a, 'T', outcome, '[]'), 'conversation_not_found');
  PERFORM pg_temp.fails(format('SELECT * FROM public.jarvis_open_task(%L, %L, %L, %L, %L, %L)',
    a, 'bbbbbbbb-1111-0000-0000-000000000001', dev_a, 'T', outcome, '[]'), 'conversation_not_found');
  PERFORM pg_temp.fails(format('SELECT * FROM public.jarvis_open_task(%L, %L, %L, %L, %L, %L)',
    a, 'aaaaaaaa-1111-0000-0000-000000000001', dev_b, 'T', outcome, '[]'), 'device_unavailable');
  PERFORM pg_temp.fails(format('SELECT * FROM public.jarvis_open_task(%L, %L, %L, %L, %L, %L)',
    a, 'aaaaaaaa-1111-0000-0000-000000000001', dev_a, 'T', outcome, '[]'), 'permission_required');

  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed) VALUES
    (a, NULL, 'master', true), (a, dev_a, 'files', true);
  PERFORM pg_temp.check(public.jarvis_allowed(a, dev_a, 'files'), 'device grant applies');
  PERFORM pg_temp.check(NOT public.jarvis_allowed(a, dev_a, 'terminal'), 'no decision means no');
  PERFORM pg_temp.check(NOT public.jarvis_allowed('bbbbbbbb-0000-0000-0000-000000000002', dev_a, 'files'), 'grant is per account');

  UPDATE public.ocade_service_controls SET paused = true WHERE key = 'jarvis_agent';
  PERFORM pg_temp.fails(format('SELECT * FROM public.jarvis_open_task(%L, %L, %L, %L, %L, %L)',
    a, 'aaaaaaaa-1111-0000-0000-000000000001', dev_a, 'T', outcome, '[]'), 'jarvis_paused');
  UPDATE public.ocade_service_controls SET paused = false WHERE key = 'jarvis_agent';

  SELECT * INTO first FROM public.jarvis_open_task(a, 'aaaaaaaa-1111-0000-0000-000000000001', dev_a, 'Reconcile', outcome, '[]');
  PERFORM pg_temp.check(first.status = 'running' AND NOT first.reused, 'task opened');
  SELECT * INTO again FROM public.jarvis_open_task(a, 'aaaaaaaa-1111-0000-0000-000000000001', dev_a, 'Reconcile', outcome, '[]');
  PERFORM pg_temp.check(again.task_id = first.task_id AND again.reused, 'repeated Send reuses the task');
  PERFORM pg_temp.fails(format('SELECT * FROM public.jarvis_open_task(%L, %L, %L, %L, %L, %L)',
    a, 'aaaaaaaa-1111-0000-0000-000000000003', dev_a, 'Other', outcome, '[]'), 'busy');
  INSERT INTO ids VALUES ('task', first.task_id), ('controller', first.controller);
END $$;

-- The browser cannot write task state or call the authority.
RESET ROLE;
SET ROLE authenticated;
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-0000-0000-000000000001", "role": "authenticated"}', false); END $$;
DO $$
BEGIN
  PERFORM pg_temp.fails($q$UPDATE public.jarvis_tasks SET status = 'running', controller = gen_random_uuid()$q$, 'permission denied');
  PERFORM pg_temp.fails($q$INSERT INTO public.jarvis_tasks (user_id, conversation_id, title) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-1111-0000-0000-000000000001', 'x')$q$, 'permission denied');
  PERFORM pg_temp.fails($q$SELECT public.jarvis_claim_action(gen_random_uuid())$q$, 'permission denied');
  PERFORM pg_temp.fails($q$SELECT public.jarvis_settle_task(gen_random_uuid(), gen_random_uuid(), '{}', 'x')$q$, 'permission denied');
  PERFORM pg_temp.check((SELECT count(*) FROM public.jarvis_tasks) = 1, 'owner sees own task');
END $$;
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"sub": "bbbbbbbb-0000-0000-0000-000000000002", "role": "authenticated"}', false); END $$;
DO $$
BEGIN
  PERFORM pg_temp.check((SELECT count(*) FROM public.jarvis_tasks) = 0, 'other account sees no task');
  PERFORM pg_temp.check((SELECT count(*) FROM public.jarvis_activity) = 0, 'other account sees no activity');
END $$;
RESET ROLE;
SET ROLE service_role;

-- Queueing, claiming and receipts.
DO $$
DECLARE
  task uuid := (SELECT id FROM ids WHERE name = 'task');
  ctl uuid := (SELECT id FROM ids WHERE name = 'controller');
  dev_a uuid := (SELECT id FROM ids WHERE name = 'dev_a');
  dev_b uuid := (SELECT id FROM ids WHERE name = 'dev_b');
  claim jsonb;
  reclaim jsonb;
BEGIN
  PERFORM pg_temp.fails(format('SELECT public.jarvis_queue_actions(%L, %L, %L)', task, gen_random_uuid(), pg_temp.act('k1')), 'stale_controller');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_queue_actions(%L, %L, %L)', task, ctl, pg_temp.act('k1', 'external_effect')), 'risk_not_supported');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_queue_actions(%L, %L, %L)', task, ctl, pg_temp.act('k1', 'read', 'terminal')), 'permission_required');
  PERFORM pg_temp.check(public.jarvis_queue_actions(task, ctl, pg_temp.act('k1')) = 1, 'queued');
  PERFORM pg_temp.check(public.jarvis_queue_actions(task, ctl, pg_temp.act('k1')) = 0, 'same key not queued twice');
  PERFORM pg_temp.check(public.jarvis_queue_actions(task, ctl, pg_temp.act('k2')) = 1, 'second action queued');

  -- Device B has no task; it gets nothing of A's.
  claim := public.jarvis_claim_action(dev_b);
  PERFORM pg_temp.check(claim -> 'task' = 'null'::jsonb AND claim -> 'action' = 'null'::jsonb, 'other device gets no work');

  claim := public.jarvis_claim_action(dev_a);
  PERFORM pg_temp.check(claim -> 'action' -> 'intent' ->> 'key' = 'k1', 'oldest action claimed first');
  reclaim := public.jarvis_claim_action(dev_a);
  PERFORM pg_temp.check(reclaim -> 'action' ->> 'id' = claim -> 'action' ->> 'id', 'restart re-claims the same action');
  PERFORM pg_temp.check((SELECT count(*) FROM public.jarvis_activity WHERE task_id = task AND status = 'claimed') = 1, 'one action in flight');

  PERFORM pg_temp.fails(format('SELECT * FROM public.jarvis_submit_receipt(%L, %L, %L)', dev_b, claim -> 'action' ->> 'id', '{"status": "observed"}'), 'unknown_action');
  PERFORM pg_temp.fails(format('SELECT * FROM public.jarvis_submit_receipt(%L, %L, %L)', dev_a, claim -> 'action' ->> 'id', '{"status": "success"}'), 'invalid_receipt');
  PERFORM pg_temp.check((SELECT outcome FROM public.jarvis_submit_receipt(dev_a, (claim -> 'action' ->> 'id')::uuid, '{"status": "observed", "evidence": {"sha256": "x"}}')) = 'accepted', 'receipt accepted');
  PERFORM pg_temp.check((SELECT outcome FROM public.jarvis_submit_receipt(dev_a, (claim -> 'action' ->> 'id')::uuid, '{"status": "observed", "evidence": {"sha256": "x"}}')) = 'duplicate', 'identical resend is a duplicate');
  PERFORM pg_temp.fails(format('SELECT * FROM public.jarvis_submit_receipt(%L, %L, %L)', dev_a, claim -> 'action' ->> 'id', '{"status": "not_applied"}'), 'receipt_conflict');

  -- Settling with an action still open is refused.
  PERFORM pg_temp.fails(format('SELECT public.jarvis_settle_task(%L, %L, %L, %L)', task, ctl, '{"passed": ["totals_reconcile", "report_pdf_renders"]}', 'x'), 'actions_open');
  claim := public.jarvis_claim_action(dev_a);
  PERFORM pg_temp.check(claim -> 'action' -> 'intent' ->> 'key' = 'k2', 'next action claimed');
  PERFORM * FROM public.jarvis_submit_receipt(dev_a, (claim -> 'action' ->> 'id')::uuid, '{"status": "observed"}');
END $$;

-- The browser cannot mark completed; a partial verification cannot complete; a full one does.
DO $$
DECLARE
  task uuid := (SELECT id FROM ids WHERE name = 'task');
  ctl uuid := (SELECT id FROM ids WHERE name = 'controller');
BEGIN
  PERFORM pg_temp.fails(format('SELECT public.jarvis_settle_task(%L, %L, %L, %L)', task, gen_random_uuid(), '{"passed": []}', 'x'), 'stale_controller');
  PERFORM pg_temp.check(public.jarvis_settle_task(task, ctl,
    '{"passed": ["totals_reconcile", "report_pdf_renders"], "failed": [], "unverified": []}', 'Reconciled') = 'completed', 'verified task completes');
  PERFORM pg_temp.check((SELECT verified_actions = 2 AND controller IS NULL AND status = 'completed' FROM public.jarvis_tasks WHERE id = task), 'completion bound to two actions');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_queue_actions(%L, %L, %L)', task, ctl, pg_temp.act('k3')), 'stale_controller');
  PERFORM pg_temp.check((SELECT status FROM public.jarvis_stop_task('aaaaaaaa-0000-0000-0000-000000000001', task)) = 'completed', 'STOP after completion changes nothing');
END $$;

-- Verification gaps leave the task blocked, never completed.
DO $$
DECLARE
  a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  dev_a uuid := (SELECT id FROM ids WHERE name = 'dev_a');
  t record;
BEGIN
  SELECT * INTO t FROM public.jarvis_open_task(a, 'aaaaaaaa-1111-0000-0000-000000000001', dev_a, 'Second',
    '[{"id": "totals_reconcile"}, {"id": "report_pdf_renders"}]', '[]');
  PERFORM pg_temp.check(public.jarvis_settle_task(t.task_id, t.controller,
    '{"passed": ["totals_reconcile"], "failed": [], "unverified": ["report_pdf_renders"]}', 'PDF not checked') = 'blocked', 'unverified check blocks');
  SELECT * INTO t FROM public.jarvis_open_task(a, 'aaaaaaaa-1111-0000-0000-000000000001', dev_a, 'Third',
    '[{"id": "totals_reconcile"}]', '[]');
  PERFORM pg_temp.check(public.jarvis_settle_task(t.task_id, t.controller,
    '{"passed": ["totals_reconcile"], "failed": ["totals_reconcile"]}', 'Mismatch') = 'blocked', 'any failed check blocks');
END $$;

-- STOP races: queued and claimed actions, stale planner, late receipt, no revival.
DO $$
DECLARE
  a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  dev_a uuid := (SELECT id FROM ids WHERE name = 'dev_a');
  t record;
  s record;
  claim jsonb;
BEGIN
  SELECT * INTO t FROM public.jarvis_open_task(a, 'aaaaaaaa-1111-0000-0000-000000000001', dev_a, 'Stoppable',
    '[{"id": "c"}]', '[]');
  PERFORM public.jarvis_queue_actions(t.task_id, t.controller, pg_temp.act('s1') || pg_temp.act('s2'));
  claim := public.jarvis_claim_action(dev_a);
  SELECT * INTO s FROM public.jarvis_stop_task(a, t.task_id);
  PERFORM pg_temp.check(s.status = 'stopped' AND s.cancelled = 1 AND s.in_flight = 1, 'STOP counts queued and in-flight');
  PERFORM pg_temp.check((SELECT result = '{"status": "unknown"}' FROM public.jarvis_activity WHERE id = (claim -> 'action' ->> 'id')::uuid), 'in-flight effect is unknown, not failed');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_queue_actions(%L, %L, %L)', t.task_id, t.controller, pg_temp.act('s3')), 'stale_controller');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_settle_task(%L, %L, %L, %L)', t.task_id, t.controller, '{"passed": ["c"]}', 'x'), 'stale_controller');
  claim := public.jarvis_claim_action(dev_a);
  PERFORM pg_temp.check(claim -> 'action' = 'null'::jsonb AND claim -> 'task' = 'null'::jsonb, 'nothing dispatched after STOP');
  PERFORM pg_temp.check((SELECT outcome FROM public.jarvis_submit_receipt(dev_a, (SELECT id FROM public.jarvis_activity WHERE task_id = t.task_id AND action ->> 'key' = 's1'),
    '{"status": "observed", "maybeChanged": true}')) = 'recorded_after_stop', 'late receipt is recorded truthfully');
  PERFORM pg_temp.check((SELECT status FROM public.jarvis_activity WHERE task_id = t.task_id AND action ->> 'key' = 's1') = 'cancelled', 'late receipt does not revive');
  PERFORM pg_temp.fails(format('UPDATE public.jarvis_tasks SET status = %L WHERE id = %L', 'completed', t.task_id), 'Only a running task can complete');
END $$;

-- Unknown effects pause the task for reconciliation; permission turned off before dispatch blocks.
DO $$
DECLARE
  a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  dev_a uuid := (SELECT id FROM ids WHERE name = 'dev_a');
  t record;
  claim jsonb;
BEGIN
  SELECT * INTO t FROM public.jarvis_open_task(a, 'aaaaaaaa-1111-0000-0000-000000000001', dev_a, 'Unknown', '[{"id": "c"}]', '[]');
  PERFORM public.jarvis_queue_actions(t.task_id, t.controller, pg_temp.act('u1') || pg_temp.act('u2'));
  claim := public.jarvis_claim_action(dev_a);
  PERFORM * FROM public.jarvis_submit_receipt(dev_a, (claim -> 'action' ->> 'id')::uuid, '{"status": "unknown", "maybeChanged": true}');
  PERFORM pg_temp.check((SELECT status FROM public.jarvis_tasks WHERE id = t.task_id) = 'waiting', 'unknown effect waits for reconciliation');
  claim := public.jarvis_claim_action(dev_a);
  PERFORM pg_temp.check(claim -> 'action' = 'null'::jsonb AND claim -> 'task' ->> 'status' = 'waiting', 'no dispatch while reconciling');
  PERFORM public.jarvis_stop_task(a, t.task_id);

  SELECT * INTO t FROM public.jarvis_open_task(a, 'aaaaaaaa-1111-0000-0000-000000000001', dev_a, 'Revoked grant', '[{"id": "c"}]', '[]');
  PERFORM public.jarvis_queue_actions(t.task_id, t.controller, pg_temp.act('r1'));
  UPDATE public.jarvis_permissions SET allowed = false WHERE capability = 'files';
  claim := public.jarvis_claim_action(dev_a);
  PERFORM pg_temp.check(claim -> 'action' = 'null'::jsonb AND claim -> 'task' ->> 'status' = 'blocked', 'revoked grant blocks at dispatch');
  UPDATE public.jarvis_permissions SET allowed = true WHERE capability = 'files';
END $$;

-- Owner emergency pause and device revocation fence dispatch.
DO $$
DECLARE
  a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  dev_a uuid := (SELECT id FROM ids WHERE name = 'dev_a');
  t record;
  claim jsonb;
BEGIN
  SELECT * INTO t FROM public.jarvis_open_task(a, 'aaaaaaaa-1111-0000-0000-000000000001', dev_a, 'Paused', '[{"id": "c"}]', '[]');
  PERFORM public.jarvis_queue_actions(t.task_id, t.controller, pg_temp.act('p1'));
  UPDATE public.ocade_service_controls SET paused = true WHERE key = 'jarvis_execution';
  claim := public.jarvis_claim_action(dev_a);
  PERFORM pg_temp.check(claim -> 'action' = 'null'::jsonb, 'owner pause stops dispatch');
  UPDATE public.ocade_service_controls SET paused = false WHERE key = 'jarvis_execution';
END $$;
DO $$
DECLARE
  a uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  dev_a uuid := (SELECT id FROM ids WHERE name = 'dev_a');
BEGIN
  PERFORM pg_temp.check(NOT public.jarvis_revoke_device('bbbbbbbb-0000-0000-0000-000000000002', dev_a), 'other account cannot revoke');
  PERFORM pg_temp.check(public.jarvis_revoke_device(a, dev_a), 'owner revokes');
  PERFORM pg_temp.check(NOT EXISTS (SELECT 1 FROM public.jarvis_tasks WHERE device_id = dev_a AND status IN ('running', 'waiting', 'taken_over')), 'revocation stops open task');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_claim_action(%L)', dev_a), 'device_unavailable');
  PERFORM pg_temp.check(NOT public.jarvis_device_seen(dev_a, 99999999), 'revoked device signatures refused');
END $$;

RESET ROLE;

-- Reads used by the web server: a revoked device has no key; state lists only actions.
SET ROLE service_role;
DO $$
DECLARE
  dev_a uuid := (SELECT id FROM ids WHERE name = 'dev_a');
  dev_b uuid := (SELECT id FROM ids WHERE name = 'dev_b');
  state jsonb := public.jarvis_task_state((SELECT id FROM ids WHERE name = 'task'));
BEGIN
  PERFORM pg_temp.check(public.jarvis_device_key(dev_a) IS NULL, 'revoked device has no key');
  PERFORM pg_temp.check(public.jarvis_device_key(dev_b) = repeat('B', 120), 'approved device key');
  PERFORM pg_temp.check(state ->> 'status' = 'completed' AND jsonb_array_length(state -> 'steps') = 2, 'task state snapshot');
END $$;
RESET ROLE;
