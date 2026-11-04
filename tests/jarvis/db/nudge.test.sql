-- The idle-pickup nudge (W2): content-free, per-device topic, sent when work is queued or the
-- task changes state, and never able to fail the change that triggered it.
-- Disposable database only. Every account/device below is synthetic; no tool is executed.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.nudge_assert(p_ok boolean, p_what text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'nudge: %', p_what; END IF;
END;
$$;
CREATE TEMP TABLE nudge_ids AS SELECT gen_random_uuid() AS user_id, gen_random_uuid() AS conversation_id;
INSERT INTO auth.users (id, email) SELECT user_id, user_id::text || '@example.test' FROM nudge_ids;
INSERT INTO public.ocade_conversations (id, user_id, title, surface)
SELECT conversation_id, user_id, 'Nudge fixture', 'jarvis' FROM nudge_ids;
UPDATE public.profiles SET online_ai_consent_at = now(), online_ai_consent_version = 'v1'
 WHERE id = (SELECT user_id FROM nudge_ids);
GRANT SELECT ON nudge_ids TO service_role;
GRANT USAGE ON SCHEMA realtime TO service_role;
GRANT SELECT, DELETE ON realtime.sent TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_user uuid := (SELECT user_id FROM nudge_ids);
  v_conversation uuid := (SELECT conversation_id FROM nudge_ids);
  v_device uuid;
  v_other uuid;
  v_topic text;
  v_task record;
  v_key text := repeat(replace(v_user::text, '-', ''), 4);
  v_key2 text := repeat(replace(v_conversation::text, '-', ''), 4);
BEGIN
  PERFORM public.jarvis_enroll_device(v_key, 'Nudge fixture', 'windows', 'test', repeat('a', 64));
  v_device := public.jarvis_approve_device(v_user, public.jarvis_device_code(v_key));
  PERFORM public.jarvis_enroll_device(v_key2, 'Other', 'windows', 'test', repeat('a', 64));
  v_other := public.jarvis_approve_device(v_user, public.jarvis_device_code(v_key2));
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
  SELECT v_user, v_device, capability, true FROM unnest(ARRAY['master', 'files']) AS grants(capability);

  v_topic := public.jarvis_device_topic(v_device);
  PERFORM pg_temp.nudge_assert(v_topic ~ '^jarvis-[0-9a-f]{32}$', 'a random per-device topic');
  PERFORM pg_temp.nudge_assert(v_topic <> public.jarvis_device_topic(v_other), 'topics differ per device');

  DELETE FROM realtime.sent;
  SELECT * INTO v_task FROM public.jarvis_open_task(v_user, v_conversation, v_device, 'Nudge fixture', NULL, '[]');
  PERFORM public.jarvis_queue_actions(v_task.task_id, v_task.controller,
    '[{"summary":"Look","action":{"key":"discover","operation":"fs.list","capability":"files","risk":"read",
      "arguments":{"path":"."}}}]'::jsonb);
  PERFORM pg_temp.nudge_assert((SELECT count(*) FROM realtime.sent WHERE topic = v_topic) >= 1,
                               'queued work nudges its device');
  PERFORM pg_temp.nudge_assert(NOT EXISTS (SELECT 1 FROM realtime.sent WHERE topic <> v_topic),
                               'no other device is nudged');
  PERFORM pg_temp.nudge_assert(NOT EXISTS (SELECT 1 FROM realtime.sent
                                            WHERE payload <> '{}'::jsonb OR private OR event <> 'nudge'),
                               'a nudge carries nothing: empty payload, public topic, one event name');

  DELETE FROM realtime.sent;
  PERFORM public.jarvis_stop_task(v_user, v_task.task_id);
  PERFORM pg_temp.nudge_assert((SELECT count(*) FROM realtime.sent WHERE topic = v_topic) >= 1,
                               'STOP nudges the device so it ends the step at once');

  PERFORM public.jarvis_revoke_device(v_user, v_device);
  PERFORM pg_temp.nudge_assert(public.jarvis_device_topic(v_device) IS NULL, 'a revoked device gets no topic');
END;
$$;

-- A Realtime failure never blocks the change itself.
RESET ROLE;
ALTER FUNCTION realtime.send(jsonb, text, text, boolean) RENAME TO send_gone;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_user uuid := (SELECT user_id FROM nudge_ids);
  v_task record;
  v_device uuid;
BEGIN
  SELECT d.id INTO v_device FROM public.jarvis_devices AS d WHERE d.user_id = v_user AND d.name = 'Other';
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
  SELECT v_user, v_device, capability, true FROM unnest(ARRAY['master', 'files']) AS grants(capability);
  SELECT * INTO v_task FROM public.jarvis_open_task(v_user, (SELECT conversation_id FROM nudge_ids), v_device,
                                                    'Nudge fixture 2', NULL, '[]');
  PERFORM pg_temp.nudge_assert(public.jarvis_queue_actions(v_task.task_id, v_task.controller,
    '[{"summary":"Look","action":{"key":"discover","operation":"fs.list","capability":"files","risk":"read",
      "arguments":{"path":"."}}}]'::jsonb) = 1, 'work is still queued when Realtime is unavailable');
END;
$$;
ROLLBACK;
