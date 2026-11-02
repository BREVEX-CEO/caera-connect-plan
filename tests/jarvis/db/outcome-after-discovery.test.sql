-- Checks are fixed once, after a read-only look; nothing changes anything before that.
-- Disposable database only. Every account/device below is synthetic; no tool is executed.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.outcome_assert(p_ok boolean, p_what text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'outcome after discovery: %', p_what; END IF;
END;
$$;
CREATE TEMP TABLE outcome_ids AS SELECT gen_random_uuid() AS user_id, gen_random_uuid() AS conversation_id;
INSERT INTO auth.users (id, email) SELECT user_id, user_id::text || '@example.test' FROM outcome_ids;
INSERT INTO public.ocade_conversations (id, user_id, title, surface)
SELECT conversation_id, user_id, 'Outcome fixture', 'jarvis' FROM outcome_ids;
GRANT SELECT ON outcome_ids TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_user uuid := (SELECT user_id FROM outcome_ids);
  v_conversation uuid := (SELECT conversation_id FROM outcome_ids);
  v_key text := repeat(replace(v_user::text, '-', ''), 4);
  v_device uuid;
  v_task record;
  v_checks jsonb := '[{"id":"out","kind":"file_exists","description":"Fixture","params":{"path":"OCADE output/a.txt"}}]';
  v_write jsonb := '[{"summary":"Write","action":{"key":"w","operation":"fs.write_text","capability":"files",
    "risk":"reversible_write","arguments":{"path":"OCADE output/a.txt","text":"x"}}}]';
BEGIN
  PERFORM pg_temp.outcome_assert(NOT public.jarvis_online_consented(v_user, 'v1'), 'no consent recorded');
  PERFORM public.jarvis_enroll_device(v_key, 'Outcome fixture', 'windows', 'test', repeat('a', 64));
  v_device := public.jarvis_approve_device(v_user, public.jarvis_device_code(v_key));
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
  SELECT v_user, v_device, capability, true FROM unnest(ARRAY['master', 'files']) AS grants(capability);
  SELECT * INTO v_task FROM public.jarvis_open_task(v_user, v_conversation, v_device, 'Outcome fixture', NULL, '[]');

  BEGIN
    PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, v_write);
    RAISE EXCEPTION 'expected outcome_required';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE '%outcome_required%' THEN RAISE; END IF;
  END;
  PERFORM pg_temp.outcome_assert(public.jarvis_queue_actions(v_task.task_id, v_task.controller,
    '[{"summary":"Look","action":{"key":"discover","operation":"fs.list","capability":"files","risk":"read",
      "arguments":{"path":"."}}}]'::jsonb) = 1, 'a read-only look may run before the checks');
  BEGIN
    PERFORM public.jarvis_set_outcome(v_task.task_id, gen_random_uuid(), v_checks, '[]');
    RAISE EXCEPTION 'expected stale_controller';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE '%stale_controller%' THEN RAISE; END IF;
  END;
  PERFORM public.jarvis_set_outcome(v_task.task_id, v_task.controller, v_checks, '["Fixture"]');
  BEGIN
    PERFORM public.jarvis_set_outcome(v_task.task_id, v_task.controller, v_checks, '[]');
    RAISE EXCEPTION 'expected outcome_fixed';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    IF SQLERRM NOT LIKE '%outcome_fixed%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.jarvis_tasks SET outcome = '[{"id":"other"}]' WHERE id = v_task.task_id;
    RAISE EXCEPTION 'expected the fixed-checks trigger';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE '%fixed once they are set%' THEN RAISE; END IF;
  END;
  PERFORM pg_temp.outcome_assert(public.jarvis_task_state(v_task.task_id) ? 'deviceSeenAt',
                                 'the task view carries when its computer was last in contact');
  PERFORM pg_temp.outcome_assert(
    public.jarvis_queue_actions(v_task.task_id, v_task.controller, v_write) = 1,
    'work that changes things is queued only after the checks are fixed');
END;
$$;
ROLLBACK;
