-- A held action loses authorization before its next claim/watch: cancel, fence and reconcile.
-- Disposable database only. Every account/device below is synthetic; no tool is executed.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.held_assert(p_ok boolean, p_what text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'held claim scope: %', p_what; END IF;
END;
$$;
CREATE TEMP TABLE held_scope_ids AS
SELECT gen_random_uuid() AS user_id, gen_random_uuid() AS conversation_id;
INSERT INTO auth.users (id, email)
SELECT user_id, user_id::text || '@example.test' FROM held_scope_ids;
INSERT INTO public.ocade_conversations (id, user_id, title, surface)
SELECT conversation_id, user_id, 'Held claim fixture', 'jarvis' FROM held_scope_ids;
GRANT SELECT ON held_scope_ids TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_user uuid := (SELECT user_id FROM held_scope_ids);
  v_conversation uuid := (SELECT conversation_id FROM held_scope_ids);
  v_key text := repeat(replace(v_user::text, '-', ''), 4);
  v_device uuid;
  v_task record;
  v_claim jsonb;
  v_case jsonb;
  v_action jsonb;
  v_extra jsonb;
  v_held uuid;
  v_cap text;
  v_controller uuid;
  v_result jsonb;
  v_checks jsonb := '[
    {"id":"web","kind":"web_text_contains","description":"Allowed page","params":{"url":"https://held.example.test/result","text":"Expected"}},
    {"id":"window","kind":"window_exists","description":"Allowed app","params":{"exe":"editor.exe"}}
  ]'::jsonb;
BEGIN
  PERFORM public.jarvis_enroll_device(v_key, 'Held claim fixture', 'windows', 'test', repeat('d', 64));
  v_device := public.jarvis_approve_device(v_user, public.jarvis_device_code(v_key));
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
  SELECT v_user, scope.device_id, grants.capability, true
    FROM (VALUES (NULL::uuid), (v_device)) AS scope(device_id)
    CROSS JOIN unnest(ARRAY['master','files','browser','site:held.example.test','apps','app:editor.exe'])
      AS grants(capability);

  FOR v_case IN SELECT value FROM jsonb_array_elements('[
    {"operation":"verify.checks","revoke":"browser"},
    {"operation":"verify.checks","revoke":"site:held.example.test"},
    {"operation":"verify.checks","revoke":"apps"},
    {"operation":"verify.checks","revoke":"app:editor.exe"},
    {"operation":"web.open","revoke":"site:held.example.test"},
    {"operation":"apps.launch","revoke":"app:editor.exe"}
  ]'::jsonb) LOOP
    v_cap := v_case ->> 'revoke';
    SELECT * INTO v_task FROM public.jarvis_open_task(
      v_user, v_conversation, v_device, 'Held revoke ' || (v_case ->> 'operation') || ' ' || v_cap, v_checks, '[]');
    v_action := jsonb_build_object(
      'v', 1, 'key', 'held', 'operation', v_case ->> 'operation',
      'capability', CASE v_case ->> 'operation' WHEN 'web.open' THEN 'browser'
                                            WHEN 'apps.launch' THEN 'apps' ELSE 'files' END,
      'risk', CASE WHEN v_case ->> 'operation' = 'apps.launch' THEN 'external_effect' ELSE 'read' END,
      'arguments', CASE v_case ->> 'operation'
        WHEN 'web.open' THEN '{"url":"https://held.example.test/result"}'::jsonb
        WHEN 'apps.launch' THEN '{"exe":"editor.exe"}'::jsonb
        ELSE jsonb_build_object('checks', v_checks) END,
      'deadlineUtc', to_char((now() AT TIME ZONE 'UTC') + interval '5 minutes', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
    IF v_case ->> 'operation' = 'web.open' THEN
      v_action := v_action || '{"target":{"site":"held.example.test"}}'::jsonb;
    ELSIF v_case ->> 'operation' = 'apps.launch' THEN
      v_action := v_action || '{"target":{"app":"editor.exe"}}'::jsonb;
    END IF;
    v_extra := jsonb_build_array(
      jsonb_build_object('summary','Queued sibling','action',jsonb_build_object(
        'key','queued','operation','fs.list','capability','files','risk','read','arguments','{}'::jsonb)),
      jsonb_build_object('summary','Confirmation sibling','action',jsonb_build_object(
        'key','confirmation','operation','apps.launch','capability','apps','risk','external_effect',
        'arguments','{"exe":"editor.exe"}'::jsonb,'target','{"app":"editor.exe"}'::jsonb)));
    -- Establish the held claim first; sibling ordering is not under test here.
    PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller,
      jsonb_build_array(jsonb_build_object('summary','Held action','action',v_action)));
    SELECT id INTO v_held FROM public.jarvis_activity
     WHERE task_id = v_task.task_id AND action ->> 'key' = 'held';
    IF v_case ->> 'operation' = 'apps.launch' THEN
      PERFORM pg_temp.held_assert(public.jarvis_confirm_action(v_user, v_held), 'owner confirms held external action');
    END IF;
    v_claim := public.jarvis_claim_action(v_device);
    PERFORM pg_temp.held_assert((v_claim -> 'action' ->> 'id')::uuid = v_held,
                               'authorized first claim holds the intended action');
    PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, v_extra);

    UPDATE public.jarvis_permissions SET allowed = false
     WHERE user_id = v_user AND device_id = v_device AND capability = v_cap;
    v_claim := public.jarvis_claim_action(v_device);
    PERFORM pg_temp.held_assert(v_claim -> 'action' = 'null'::jsonb
                               AND v_claim -> 'task' ->> 'status' = 'waiting',
                               'held action revoked at watch cannot be redelivered: ' || v_cap);
    PERFORM pg_temp.held_assert(
      (SELECT status = 'waiting' AND controller IS NULL AND paused_at IS NOT NULL
         FROM public.jarvis_tasks WHERE id = v_task.task_id),
      'revocation fences controller and waits for reconciliation');
    PERFORM pg_temp.held_assert(
      (SELECT status = 'cancelled' AND result = '{"status":"unknown"}'::jsonb
         FROM public.jarvis_activity WHERE id = v_held),
      'a held action is unknown, never called unapplied');
    PERFORM pg_temp.held_assert(
      (SELECT count(*) = 2 AND bool_and(status = 'cancelled'
        AND result ->> 'status' = 'not_applied' AND result -> 'maybeChanged' = 'false'::jsonb)
         FROM public.jarvis_activity WHERE task_id = v_task.task_id AND id <> v_held),
      'queued and confirmation siblings are cancelled with no possible effect');
    PERFORM pg_temp.held_assert(
      NOT EXISTS (SELECT 1 FROM public.jarvis_activity WHERE task_id = v_task.task_id
                   AND status IN ('queued','claimed','needs_confirmation')),
      'no stale-controller open siblings can strand a resumed task');
    BEGIN
      PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, v_extra);
      RAISE EXCEPTION 'expected stale_controller after held permission revocation';
    EXCEPTION WHEN insufficient_privilege THEN
      IF SQLERRM NOT LIKE '%stale_controller%' THEN RAISE; END IF;
    END;
    PERFORM pg_temp.held_assert(public.jarvis_claim_action(v_device) -> 'action' = 'null'::jsonb,
                               'waiting fence starts nothing');

    -- The real late result replaces only the unknown marker; cancellation is never revived.
    v_result := jsonb_build_object('status','observed','maybeChanged',true,
      'observedAtUtc',to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'evidence',jsonb_build_object('fixture','late result'));
    PERFORM pg_temp.held_assert(
      (SELECT outcome FROM public.jarvis_submit_receipt(v_device, v_held, v_result)) = 'recorded_after_stop',
      'late receipt is retained honestly after permission revocation');
    PERFORM pg_temp.held_assert(
      (SELECT status = 'cancelled' AND result = v_result FROM public.jarvis_activity WHERE id = v_held),
      'late observation does not revive cancelled action');
    UPDATE public.jarvis_permissions SET allowed = true
     WHERE user_id = v_user AND device_id = v_device AND capability = v_cap;
    v_controller := public.jarvis_resume_task(v_user, v_task.task_id);
    PERFORM pg_temp.held_assert(v_controller IS DISTINCT FROM v_task.controller, 'resume has a fresh controller');
    PERFORM pg_temp.held_assert(public.jarvis_claim_action(v_device) -> 'action' = 'null'::jsonb,
                               'restored permission never resurrects old siblings');
    PERFORM public.jarvis_queue_actions(v_task.task_id, v_controller,
      jsonb_build_array(jsonb_build_object('summary','Fresh observation','action',jsonb_build_object(
        'key','fresh','operation','fs.list','capability','files','risk','read','arguments','{}'::jsonb))));
    PERFORM pg_temp.held_assert(
      public.jarvis_claim_action(v_device) -> 'action' -> 'intent' ->> 'key' = 'fresh',
      'new work uses only the resumed controller');
    PERFORM public.jarvis_stop_task(v_user, v_task.task_id);
  END LOOP;
END;
$$;
RESET ROLE;
ROLLBACK;
