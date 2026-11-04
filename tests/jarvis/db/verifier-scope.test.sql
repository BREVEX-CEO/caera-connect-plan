-- Verifier permissions are checked again at queue and claim, including every nested target.
-- Disposable database only: run.sh replays migrations first. No tool or website is accessed.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;

CREATE FUNCTION pg_temp.verifier_assert(p_ok boolean, p_what text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'verifier scope: %', p_what; END IF;
END;
$$;

CREATE TEMP TABLE verifier_scope_ids AS
SELECT gen_random_uuid() AS user_id, gen_random_uuid() AS conversation_id;
INSERT INTO auth.users (id, email)
SELECT user_id, user_id::text || '@example.test' FROM verifier_scope_ids;
INSERT INTO public.ocade_conversations (id, user_id, title, surface)
SELECT conversation_id, user_id, 'Verifier scope fixture', 'jarvis' FROM verifier_scope_ids;
GRANT SELECT ON verifier_scope_ids TO service_role;
SET LOCAL ROLE service_role;

DO $$
DECLARE
  v_user uuid := (SELECT user_id FROM verifier_scope_ids);
  v_conversation uuid := (SELECT conversation_id FROM verifier_scope_ids);
  v_key text := repeat(replace(v_user::text, '-', ''), 4);
  v_device uuid;
  v_task record;
  v_claim jsonb;
  v_cap text;
  v_action jsonb;
  v_checks jsonb := '[
    {"id":"web_a","kind":"web_text_contains","description":"First allowed website","params":{"url":"https://allowed.example.test/a","text":"Expected"}},
    {"id":"web_b","kind":"web_text_contains","description":"Second allowed website","params":{"url":"https://other.example.test/b","text":"Expected"}},
    {"id":"app_a","kind":"window_exists","description":"First allowed app","params":{"exe":"editor.exe"}},
    {"id":"app_b","kind":"window_exists","description":"Second allowed app","params":{"exe":"reviewer.exe"}}
  ]'::jsonb;
  v_file_checks jsonb := '[{"id":"file","kind":"file_exists","description":"Workspace output","params":{"path":"report.txt"}}]'::jsonb;
BEGIN
  PERFORM public.jarvis_enroll_device(v_key, 'Verifier scope fixture', 'windows', 'test', repeat('c', 64));
  v_device := public.jarvis_approve_device(v_user, public.jarvis_device_code(v_key));
  -- Device-specific denial must override an account-wide allow.
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
  SELECT v_user, NULL::uuid, capability, true
    FROM unnest(ARRAY['master','files','browser','apps','site:allowed.example.test',
                      'site:other.example.test','app:editor.exe','app:reviewer.exe']) AS grants(capability);
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
  SELECT v_user, v_device, capability, true
    FROM unnest(ARRAY['master','files','browser','apps','site:allowed.example.test',
                      'site:other.example.test','app:editor.exe','app:reviewer.exe']) AS grants(capability);

  -- Positive control: the same multi-site/multi-app verification is dispatchable with all grants.
  SELECT * INTO v_task FROM public.jarvis_open_task(
    v_user, v_conversation, v_device, 'Authorized verifier', v_checks, '[]');
  v_action := jsonb_build_object(
    'v', 1, 'key', 'authorized', 'operation', 'verify.checks', 'capability', 'files', 'risk', 'read',
    'arguments', jsonb_build_object('checks', v_checks),
    'deadlineUtc', to_char((now() AT TIME ZONE 'UTC') + interval '5 minutes', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  PERFORM pg_temp.verifier_assert(
    public.jarvis_queue_actions(v_task.task_id, v_task.controller,
      jsonb_build_array(jsonb_build_object('summary', 'Verify fixed checks', 'action', v_action))) = 1,
    'authorized verifier queues');
  v_claim := public.jarvis_claim_action(v_device);
  PERFORM pg_temp.verifier_assert(v_claim -> 'action' -> 'intent' = v_action,
                                 'authorized verifier is claimed unchanged');
  PERFORM public.jarvis_stop_task(v_user, v_task.task_id);

  -- Reachable race: all grants existed when queued; revoke one before the device claims.
  FOREACH v_cap IN ARRAY ARRAY['browser','site:allowed.example.test','site:other.example.test',
                               'apps','app:editor.exe','app:reviewer.exe'] LOOP
    SELECT * INTO v_task FROM public.jarvis_open_task(
      v_user, v_conversation, v_device, 'Revoked before verifier claim: ' || v_cap, v_checks, '[]');
    v_action := v_action || jsonb_build_object('key', 'claim:' || replace(v_cap, ':', '_'));
    PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller,
      jsonb_build_array(jsonb_build_object('summary', 'Verify fixed checks', 'action', v_action)));
    UPDATE public.jarvis_permissions SET allowed = false
     WHERE user_id = v_user AND device_id = v_device AND capability = v_cap;
    v_claim := public.jarvis_claim_action(v_device);
    PERFORM pg_temp.verifier_assert(
      v_claim -> 'action' = 'null'::jsonb AND v_claim -> 'task' ->> 'status' = 'blocked',
      'revoked ' || v_cap || ' cannot dispatch queued verifier');
    PERFORM pg_temp.verifier_assert(
      (SELECT status = 'blocked' AND result ->> 'status' = 'not_applied'
              AND result ->> 'errorCode' = 'permission_revoked'
         FROM public.jarvis_activity WHERE task_id = v_task.task_id),
      'revoked verifier records a pre-dispatch permission refusal: ' || v_cap);
    UPDATE public.jarvis_permissions SET allowed = true
     WHERE user_id = v_user AND device_id = v_device AND capability = v_cap;
  END LOOP;

  -- A stale planner snapshot must also fail at admission, before a row is queued.
  FOREACH v_cap IN ARRAY ARRAY['browser','site:other.example.test','apps','app:reviewer.exe'] LOOP
    SELECT * INTO v_task FROM public.jarvis_open_task(
      v_user, v_conversation, v_device, 'Revoked before verifier queue: ' || v_cap, v_checks, '[]');
    v_action := v_action || jsonb_build_object('key', 'queue:' || replace(v_cap, ':', '_'));
    UPDATE public.jarvis_permissions SET allowed = false
     WHERE user_id = v_user AND device_id = v_device AND capability = v_cap;
    BEGIN
      PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller,
        jsonb_build_array(jsonb_build_object('summary', 'Verify fixed checks', 'action', v_action)));
      RAISE EXCEPTION 'expected permission_required for revoked verifier target: %', v_cap;
    EXCEPTION WHEN insufficient_privilege THEN
      IF SQLERRM NOT LIKE '%permission_required%' THEN RAISE; END IF;
    END;
    PERFORM pg_temp.verifier_assert(
      NOT EXISTS (SELECT 1 FROM public.jarvis_activity WHERE task_id = v_task.task_id),
      'revoked verifier was not admitted: ' || v_cap);
    UPDATE public.jarvis_permissions SET allowed = true
     WHERE user_id = v_user AND device_id = v_device AND capability = v_cap;
    PERFORM public.jarvis_stop_task(v_user, v_task.task_id);
  END LOOP;

  -- File-only predicates need file permission, even when all website/app grants are off.
  UPDATE public.jarvis_permissions SET allowed = false
   WHERE user_id = v_user AND device_id = v_device AND capability NOT IN ('master', 'files');
  SELECT * INTO v_task FROM public.jarvis_open_task(
    v_user, v_conversation, v_device, 'File-only verifier', v_file_checks, '[]');
  v_action := v_action || jsonb_build_object('key', 'file-only',
                                           'arguments', jsonb_build_object('checks', v_file_checks));
  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller,
    jsonb_build_array(jsonb_build_object('summary', 'Verify workspace output', 'action', v_action)));
  v_claim := public.jarvis_claim_action(v_device);
  PERFORM pg_temp.verifier_assert(v_claim -> 'action' -> 'intent' = v_action,
                                 'unrelated revoked targets do not block file-only verification');
  PERFORM public.jarvis_stop_task(v_user, v_task.task_id);

  -- The read-only script, formula and heading predicates stay inside the workspace too.
  PERFORM pg_temp.verifier_assert(public.jarvis_action_allowed(v_user, v_device, v_action || jsonb_build_object(
    'arguments', jsonb_build_object('checks', '[
      {"id":"s","kind":"script_runnable","description":"Runs","params":{"path":"run.sh"}},
      {"id":"f","kind":"workbook_formula","description":"Formula","params":{"path":"a.xlsx","sheet":"S","cell":"B2"}},
      {"id":"h","kind":"document_headings","description":"Headings","params":{"path":"a.docx","headings":["Summary"]}}
    ]'::jsonb))), 'script, formula and heading checks need only file permission');
  PERFORM pg_temp.verifier_assert(NOT public.jarvis_action_allowed(v_user, v_device, v_action || jsonb_build_object(
    'arguments', jsonb_build_object('checks', '[{"id":"x","kind":"script_runs","params":{"path":"run.sh"}}]'::jsonb))),
    'an unknown predicate is still refused');
  PERFORM pg_temp.verifier_assert(NOT public.jarvis_action_allowed(v_user, v_device, v_action || jsonb_build_object(
    'arguments', jsonb_build_object('checks', '[{"id":"p","kind":"local_service_answers","params":{"port":8080}}]'::jsonb))),
    'a loopback service check needs the computer-control grant');
  PERFORM pg_temp.verifier_assert(NOT public.jarvis_action_allowed(v_user, v_device, v_action || jsonb_build_object(
    'arguments', jsonb_build_object('checks', '[{"id":"c","kind":"command_succeeds","params":{"command":"./run.sh"}}]'::jsonb))),
    'a re-run check needs the computer-control grant');
END;
$$;

RESET ROLE;
ROLLBACK;
