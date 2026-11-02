-- The person resolves an unknown effect; the step itself is never handed out again.
-- Disposable database only. Every account/device below is synthetic; no tool is executed.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.resolve_assert(p_ok boolean, p_what text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'effect resolution: %', p_what; END IF;
END;
$$;
CREATE TEMP TABLE resolve_ids AS
SELECT gen_random_uuid() AS user_id, gen_random_uuid() AS other_id, gen_random_uuid() AS conversation_id;
INSERT INTO auth.users (id, email)
SELECT user_id, user_id::text || '@example.test' FROM resolve_ids
UNION ALL SELECT other_id, other_id::text || '@example.test' FROM resolve_ids;
INSERT INTO public.ocade_conversations (id, user_id, title, surface)
SELECT conversation_id, user_id, 'Effect resolution fixture', 'jarvis' FROM resolve_ids;
GRANT SELECT ON resolve_ids TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_user uuid := (SELECT user_id FROM resolve_ids);
  v_other uuid := (SELECT other_id FROM resolve_ids);
  v_conversation uuid := (SELECT conversation_id FROM resolve_ids);
  v_key text := repeat(replace(v_user::text, '-', ''), 4);
  v_device uuid;
  v_task record;
  v_claim jsonb;
  v_write uuid;
  v_read uuid;
  v_before jsonb;
BEGIN
  PERFORM public.jarvis_enroll_device(v_key, 'Resolution fixture', 'windows', 'test', repeat('f', 64));
  v_device := public.jarvis_approve_device(v_user, public.jarvis_device_code(v_key));
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
  SELECT v_user, v_device, capability, true FROM unnest(ARRAY['master', 'files']) AS grants(capability);
  SELECT * INTO v_task FROM public.jarvis_open_task(v_user, v_conversation, v_device, 'Resolution fixture',
    '[{"id":"file","kind":"file_exists","description":"Fixture","params":{"path":"OCADE output/a.txt"}}]', '[]');

  -- An observed read needs no answer.
  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, '[{"summary":"Look","action":
    {"key":"look","operation":"fs.list","capability":"files","risk":"read","arguments":{}}}]'::jsonb);
  v_read := (public.jarvis_claim_action(v_device) -> 'action' ->> 'id')::uuid;
  PERFORM pg_temp.resolve_assert((SELECT claimed_at IS NOT NULL FROM public.jarvis_activity WHERE id = v_read),
                                 'a claim records when the device picked the step up');
  PERFORM public.jarvis_submit_receipt(v_device, v_read, '{"status":"observed","maybeChanged":false,
    "observedAtUtc":"2026-11-02T00:00:00.000Z","evidence":{}}'::jsonb);

  -- A write whose receipt is unknown fences the task.
  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, '[{"summary":"Write","action":
    {"key":"write","operation":"fs.write_text","capability":"files","risk":"reversible_write",
     "arguments":{"path":"OCADE output/a.txt","text":"x"}}}]'::jsonb);
  v_write := (public.jarvis_claim_action(v_device) -> 'action' ->> 'id')::uuid;
  PERFORM public.jarvis_submit_receipt(v_device, v_write, '{"status":"unknown","maybeChanged":true,
    "observedAtUtc":"2026-11-02T00:00:00.000Z","evidence":{},"errorCode":"worker_lost"}'::jsonb);
  PERFORM pg_temp.resolve_assert((SELECT status = 'waiting' FROM public.jarvis_tasks WHERE id = v_task.task_id),
                                 'an unknown write waits for the person');
  SELECT result INTO v_before FROM public.jarvis_activity WHERE id = v_write;

  PERFORM pg_temp.resolve_assert(NOT public.jarvis_resolve_effect(v_other, v_write, 'applied'),
                                 'another account cannot answer');
  PERFORM pg_temp.resolve_assert(NOT public.jarvis_resolve_effect(v_user, v_read, 'applied'),
                                 'an observed step needs no answer');
  BEGIN
    PERFORM public.jarvis_resolve_effect(v_user, v_write, 'maybe');
    RAISE EXCEPTION 'expected invalid_resolution';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM NOT LIKE '%invalid_resolution%' THEN RAISE; END IF;
  END;
  PERFORM pg_temp.resolve_assert(public.jarvis_resolve_effect(v_user, v_write, 'applied'),
                                 'the owner answers once');
  PERFORM pg_temp.resolve_assert(NOT public.jarvis_resolve_effect(v_user, v_write, 'not_applied'),
                                 'an answer cannot be changed');
  PERFORM pg_temp.resolve_assert(
    (SELECT status = 'blocked' AND result = v_before AND resolution = 'applied'
       FROM public.jarvis_activity WHERE id = v_write),
    'the recorded step and its receipt stay exactly as they were');
  PERFORM pg_temp.resolve_assert(
    (SELECT step ->> 'resolution' = 'applied'
       FROM jsonb_array_elements(public.jarvis_task_state(v_task.task_id) -> 'steps') AS step
      WHERE step ->> 'id' = v_write::text),
    'the planner and the page see the answer');

  PERFORM public.jarvis_resume_task(v_user, v_task.task_id);
  PERFORM pg_temp.resolve_assert(public.jarvis_claim_action(v_device) -> 'action' = 'null'::jsonb,
                                 'a resolved step is never handed out again');
  PERFORM pg_temp.resolve_assert(NOT public.jarvis_resolve_effect(v_user, v_write, 'applied'),
                                 'nothing is answered while the task runs');
END;
$$;
ROLLBACK;
