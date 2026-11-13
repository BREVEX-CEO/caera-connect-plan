-- P3: a guarded batch stops at its first step that did not apply or whose effect is unknown.
-- The steps queued behind it are cancelled in the receipt's own transaction and are never
-- handed out; a step that was observed leaves the rest of its batch queued.
-- Disposable database only; every account/device is synthetic.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.batch_assert(p_ok boolean, p_what text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'batch stop: %', p_what; END IF;
END;
$$;
CREATE TEMP TABLE batch_ids AS SELECT gen_random_uuid() AS user_id, gen_random_uuid() AS conversation_id;
INSERT INTO auth.users (id, email) SELECT user_id, user_id::text || '@example.test' FROM batch_ids;
INSERT INTO public.ocade_conversations (id, user_id, title, surface)
SELECT conversation_id, user_id, 'Batch fixture', 'jarvis' FROM batch_ids;
GRANT SELECT ON batch_ids TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_user uuid := (SELECT user_id FROM batch_ids);
  v_key text := repeat(replace(v_user::text, '-', ''), 4);
  v_device uuid;
  v_task record;
  v_claimed uuid;
  v_status text;
  v_batch jsonb;
  v_receipt jsonb;
  v_deadline text := to_char((now() AT TIME ZONE 'UTC') + interval '5 minutes', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
  PERFORM public.jarvis_enroll_device(v_key, 'Batch fixture', 'windows', 'test', repeat('b', 64));
  v_device := public.jarvis_approve_device(v_user, public.jarvis_device_code(v_key));
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
  SELECT v_user, v_device, capability, true FROM unnest(ARRAY['master', 'files']) AS grants(capability);

  FOREACH v_status IN ARRAY ARRAY['observed', 'not_applied', 'unknown'] LOOP
    SELECT * INTO v_task FROM public.jarvis_open_task(v_user, (SELECT conversation_id FROM batch_ids), v_device,
                                                      'Batch ' || v_status, NULL, '[]');
    SELECT jsonb_agg(jsonb_build_object('summary', 'Step ' || n, 'action', jsonb_build_object(
             'v', 1, 'key', 's' || n, 'operation', 'fs.list', 'capability', 'files', 'risk', 'read',
             'arguments', '{"path":"."}'::jsonb, 'deadlineUtc', v_deadline)))
      INTO v_batch FROM generate_series(1, 3) AS n;
    PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller, v_batch);
    v_claimed := (public.jarvis_claim_action(v_device) -> 'action' ->> 'id')::uuid;
    v_receipt := jsonb_build_object('status', v_status, 'maybeChanged', v_status = 'unknown',
                                    'observedAtUtc', v_deadline, 'evidence', '{}'::jsonb);
    PERFORM public.jarvis_submit_receipt(v_device, v_claimed, v_receipt);
    IF v_status = 'observed' THEN
      PERFORM pg_temp.batch_assert((SELECT count(*) = 2 FROM public.jarvis_activity
                                     WHERE task_id = v_task.task_id AND status = 'queued'),
                                   'an observed step leaves its batch queued');
      PERFORM pg_temp.batch_assert(public.jarvis_claim_action(v_device) #>> '{action,intent,key}' = 's2',
                                   'the next step of the batch is handed out in order');
      PERFORM public.jarvis_stop_task(v_user, v_task.task_id);
    ELSE
      PERFORM pg_temp.batch_assert((SELECT count(*) = 2 FROM public.jarvis_activity
                                     WHERE task_id = v_task.task_id AND status = 'cancelled'
                                       AND result ->> 'errorCode' = 'batch_stopped'
                                       AND result ->> 'status' = 'not_applied'
                                       AND (result ->> 'maybeChanged')::boolean = false),
                                   v_status || ' cancels every step queued behind it as not applied');
      PERFORM pg_temp.batch_assert(public.jarvis_claim_action(v_device) -> 'action' = 'null'::jsonb,
                                   v_status || ': nothing of the batch is handed out');
      PERFORM public.jarvis_stop_task(v_user, v_task.task_id);
    END IF;
  END LOOP;
END;
$$;
ROLLBACK;
