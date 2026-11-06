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
  FOR i IN 2..10 LOOP
    PERFORM public.jarvis_queue_actions(t.task_id, t.controller, pg_temp.act('p' || i));
  END LOOP;
  PERFORM pg_temp.check(public.jarvis_queue_actions(t.task_id, t.controller, pg_temp.act('p1')) = 0,
                       'replay succeeds even at capacity');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_queue_actions(%L, %L, %L)',
    t.task_id, t.controller, pg_temp.act('overflow')), 'queue_full');
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
    VALUES (a, dev_a, 'computer_control', true);
  claim := public.jarvis_claim_action(dev_a);
  PERFORM pg_temp.check(claim -> 'jobsAllowed' = 'true'::jsonb, 'claim proves a current job grant');
  UPDATE public.ocade_service_controls SET paused = true WHERE key = 'jarvis_execution';
  claim := public.jarvis_claim_action(dev_a);
  PERFORM pg_temp.check(claim -> 'action' = 'null'::jsonb AND claim -> 'paused' = 'true'::jsonb
    AND claim -> 'jobsAllowed' = 'false'::jsonb, 'owner pause stops dispatch and detached jobs');
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

-- Exact target grants, confirmation of external effects, Take Over/Resume, waiting, answers, inventory.
SET ROLE service_role;
DO $$
DECLARE
  b uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  dev_b uuid := (SELECT id FROM ids WHERE name = 'dev_b');
  t record;
  claim jsonb;
  pending uuid;
  web jsonb := '{"key": "w1", "capability": "browser", "risk": "external_effect", "operation": "web.click", "target": {"site": "example.com"}}';
BEGIN
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed) VALUES
    (b, NULL, 'master', true), (b, dev_b, 'files', true), (b, dev_b, 'browser', true);
  PERFORM pg_temp.check(NOT public.jarvis_action_allowed(b, dev_b, web), 'site needs its own grant');
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed) VALUES (b, dev_b, 'site:example.com', true);
  PERFORM pg_temp.check(public.jarvis_action_allowed(b, dev_b, web), 'granted site allowed');
  PERFORM pg_temp.check(NOT public.jarvis_action_allowed(b, dev_b, web || '{"target": {"site": "evil.example"}}'), 'other site refused');
  PERFORM pg_temp.check(NOT public.jarvis_action_allowed(b, dev_b, '{"capability": "apps", "target": {"app": "notepad.exe"}}'), 'app needs grants');
  PERFORM pg_temp.check(NOT public.jarvis_action_allowed(b, dev_b, '{"capability": "mcp", "target": {"mcp": "echo"}}'), 'mcp server needs grants');
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed) VALUES (b, dev_b, 'mcp', true), (b, dev_b, 'mcp:echo', true);
  PERFORM pg_temp.check(public.jarvis_action_allowed(b, dev_b, '{"capability": "mcp", "target": {"mcp": "echo"}}'), 'granted mcp server allowed');
  PERFORM pg_temp.fails($q$INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed) VALUES ('bbbbbbbb-0000-0000-0000-000000000002', NULL, 'mcp:Bad Name', true)$q$, 'check');
  PERFORM pg_temp.check((SELECT public.jarvis_grants(b, dev_b) @> '["files", "browser", "site:example.com", "mcp:echo"]'), 'grants listed');

  SELECT * INTO t FROM public.jarvis_open_task(b, 'bbbbbbbb-1111-0000-0000-000000000001', dev_b, 'Web task', '[{"id": "c"}]', '[]');
  PERFORM public.jarvis_queue_actions(t.task_id, t.controller, jsonb_build_array(jsonb_build_object('summary', 'Submit', 'action', web)));
  pending := (SELECT id FROM public.jarvis_activity WHERE task_id = t.task_id);
  PERFORM pg_temp.check((SELECT status FROM public.jarvis_activity WHERE id = pending) = 'needs_confirmation', 'external effect waits');
  claim := public.jarvis_claim_action(dev_b);
  PERFORM pg_temp.check(claim -> 'action' = 'null'::jsonb, 'unconfirmed step is never dispatched');
  PERFORM pg_temp.check(NOT public.jarvis_confirm_action('aaaaaaaa-0000-0000-0000-000000000001', pending), 'only the owner confirms');
  PERFORM pg_temp.check(public.jarvis_confirm_action(b, pending), 'owner confirms');
  PERFORM pg_temp.check(NOT public.jarvis_confirm_action(b, pending), 'confirmation is one-use');
  claim := public.jarvis_claim_action(dev_b);
  PERFORM pg_temp.check((claim -> 'action' ->> 'id')::uuid = pending, 'confirmed step dispatched');

  PERFORM pg_temp.check(public.jarvis_take_over(b, t.task_id) = 'taken_over', 'take over');
  PERFORM pg_temp.check((SELECT status FROM public.jarvis_activity WHERE id = pending) = 'cancelled', 'running step cancelled on take over');
  PERFORM pg_temp.check(public.jarvis_claim_action(dev_b) -> 'action' = 'null'::jsonb, 'nothing dispatched while the person has control');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_queue_actions(%L, %L, %L)', t.task_id, t.controller, pg_temp.act('after')), 'stale_controller');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_resume_task(%L, %L)', 'aaaaaaaa-0000-0000-0000-000000000001', t.task_id), 'task_not_found');
  PERFORM pg_temp.check(public.jarvis_resume_task(b, t.task_id) IS DISTINCT FROM t.controller, 'resume issues a new controller');
  PERFORM public.jarvis_task_wait(t.task_id, t.controller, 'stale');
  PERFORM pg_temp.check((SELECT status FROM public.jarvis_tasks WHERE id = t.task_id) = 'running', 'a stale controller cannot park the task');
  PERFORM public.jarvis_task_wait(t.task_id, (SELECT controller FROM public.jarvis_tasks WHERE id = t.task_id), 'Planner unavailable');
  PERFORM pg_temp.check((SELECT status = 'waiting' AND blocker = 'Planner unavailable' FROM public.jarvis_tasks WHERE id = t.task_id), 'planner outage waits');
  PERFORM public.jarvis_stop_task(b, t.task_id);
  PERFORM public.jarvis_stop_task(b, t.task_id);
  PERFORM pg_temp.check((SELECT count(*) FROM public.ocade_messages WHERE conversation_id = 'bbbbbbbb-1111-0000-0000-000000000001') = 1, 'STOP answer written once');

  PERFORM public.jarvis_device_inventory(dev_b, '[{"name": "Notepad", "exe": "notepad.exe"}]', '[{"id": "echo"}]', '["ffmpeg"]');
  PERFORM pg_temp.check((SELECT installed_apps -> 0 ->> 'exe' = 'notepad.exe' AND capabilities -> 'mcp' -> 0 ->> 'id' = 'echo'
                           FROM public.jarvis_devices WHERE id = dev_b), 'inventory recorded');

  -- Rows from earlier engines kept a keystroke in action.key; repeats must stay storable.
  INSERT INTO public.jarvis_activity (user_id, task_id, device_id, summary, action, status)
  VALUES (b, t.task_id, dev_b, 'legacy', '{"key": "Escape"}', 'done'),
         (b, t.task_id, dev_b, 'legacy', '{"key": "Escape"}', 'done');
  PERFORM pg_temp.check(true, 'legacy keystroke rows do not collide with the idempotency index');
END $$;
RESET ROLE;

-- Browser ownership expires independently of the companion's signed device identity.
INSERT INTO auth.sessions (id, user_id, not_after) VALUES
  ('aaaaaaaa-5555-4000-8000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', NULL),
  ('bbbbbbbb-5555-4000-8000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', NULL),
  ('bbbbbbbb-5555-4000-8000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', NULL),
  ('bbbbbbbb-5555-4000-8000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', now() - interval '1 second'),
  ('bbbbbbbb-5555-4000-8000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000002', NULL);
SET ROLE service_role;
DO $$
DECLARE
  owner_id uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  conversation uuid := 'bbbbbbbb-1111-0000-0000-000000000001';
  device uuid := (SELECT id FROM ids WHERE name = 'dev_b');
  first_session uuid := 'bbbbbbbb-5555-4000-8000-000000000001';
  next_session uuid := 'bbbbbbbb-5555-4000-8000-000000000002';
  resumed_session uuid := 'bbbbbbbb-5555-4000-8000-000000000004';
  task record;
  controller uuid;
  action_id uuid;
  reply jsonb;
  pointer_action jsonb := '{
    "key":"pointer-fixture","operation":"ui.click_point","capability":"computer_control",
    "risk":"external_effect","target":{"app":"session-fixture.exe"},
    "arguments":{"window":{"exe":"session-fixture.exe","pid":7,"hwnd":11,"started":20},
                 "x":0.5,"y":0.5,"expectTitle":"Fixture"}
  }';
BEGIN
  PERFORM pg_temp.fails(format('SELECT * FROM public.jarvis_open_task(%L,%L,%L,%L,NULL,%L,%L)',
    owner_id, conversation, device, 'Forged session', '[]', 'aaaaaaaa-5555-4000-8000-000000000001'),
    'session_ended');
  PERFORM pg_temp.fails(format('SELECT * FROM public.jarvis_open_task(%L,%L,%L,%L,NULL,%L,%L)',
    owner_id, conversation, device, 'Expired session', '[]', 'bbbbbbbb-5555-4000-8000-000000000003'),
    'session_ended');
  SELECT * INTO task FROM public.jarvis_open_task(owner_id, conversation, device, 'Browser task',
                                                  '[{"id":"result"}]', '[]', first_session);
  PERFORM pg_temp.check((public.jarvis_task_state(task.task_id) ->> 'sessionLive')::boolean,
                       'task is bound to the current browser session');
  PERFORM pg_temp.check(NOT (public.jarvis_task_state(task.task_id) -> 'checkpoint' ? 'authorizedSessionId'),
                       'task state does not expose the session identifier');

  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
    VALUES (owner_id, device, 'computer_control', true),
           (owner_id, device, 'app:session-fixture.exe', true)
    ON CONFLICT (user_id, device_id, capability) DO UPDATE SET allowed = true;
  PERFORM pg_temp.check(NOT public.jarvis_action_allowed(owner_id, device, pointer_action),
                        'a pointer action needs current screen consent');
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
    VALUES (owner_id, device, 'screen', true)
    ON CONFLICT (user_id, device_id, capability) DO UPDATE SET allowed = true;
  PERFORM public.jarvis_queue_actions(task.task_id, task.controller,
    jsonb_build_array(jsonb_build_object('summary','click fixture','action',pointer_action)));
  SELECT id INTO action_id FROM public.jarvis_activity
    WHERE task_id = task.task_id AND action ->> 'key' = 'pointer-fixture';
  PERFORM pg_temp.check(public.jarvis_confirm_action(owner_id, action_id), 'exact fixture effect approved');
  PERFORM pg_temp.check((public.jarvis_claim_action(device) #>> '{action,id}')::uuid = action_id,
                       'signed device can pick up the authorized action');
  UPDATE public.jarvis_permissions SET allowed = false
   WHERE user_id = owner_id AND device_id = device AND capability = 'screen';
  reply := public.jarvis_claim_action(device);
  PERFORM pg_temp.check(reply -> 'action' = 'null'::jsonb AND reply #>> '{task,status}' = 'waiting',
                       'revocation withholds the held visual action');

  PERFORM public.ocade_revoke_account_session(owner_id, first_session);
  reply := public.jarvis_claim_action(device);
  PERFORM pg_temp.check(reply -> 'action' = 'null'::jsonb AND reply #>> '{task,status}' = 'stopped'
                         AND reply -> 'jobsAllowed' = 'false'::jsonb,
                       'the signed companion cannot keep a task after its browser signs out');

  SELECT * INTO task FROM public.jarvis_open_task(owner_id, conversation, device, 'Second browser task',
                                                  '[{"id":"result"}]', '[]', next_session);
  PERFORM public.jarvis_take_over(owner_id, task.task_id);
  controller := public.jarvis_resume_task(owner_id, task.task_id, resumed_session);
  PERFORM pg_temp.check(controller IS DISTINCT FROM task.controller, 'continuing binds the new browser session');
  PERFORM public.ocade_revoke_account_session(owner_id, next_session);
  PERFORM pg_temp.check((public.jarvis_task_state(task.task_id) ->> 'sessionLive')::boolean,
                       'a prior browser no longer owns a resumed task');
  PERFORM public.ocade_revoke_account_session(owner_id, resumed_session);
  PERFORM pg_temp.check(public.jarvis_queue_actions(task.task_id, controller, pg_temp.act('after-signout')) = 0,
                       'a planner holding the old controller cannot admit work after sign-out');
  PERFORM pg_temp.check((SELECT status = 'stopped' FROM public.jarvis_tasks WHERE id = task.task_id),
                       'admission persists the STOP fence');
END $$;
RESET ROLE;
