-- Replay (ELITE-02): only the task's current controller sets a replay list, only before any step,
-- only replayable file/document/media operations, at most 30. Disposable database only.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE TEMP TABLE r_ids AS SELECT gen_random_uuid() AS u, gen_random_uuid() AS c;
INSERT INTO auth.users (id, email) SELECT u, u::text || '@example.test' FROM r_ids;
INSERT INTO public.ocade_conversations (id, user_id, title, surface) SELECT c, u, 'R', 'jarvis' FROM r_ids;
GRANT SELECT ON r_ids TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_user uuid := (SELECT u FROM r_ids);
  v_key text := repeat(replace(v_user::text, '-', ''), 4);
  v_device uuid;
  v_task record;
  v_ok jsonb := '[{"operation":"fs.write_text","arguments":{"path":"OCADE output/a.txt","text":"x"}}]';
BEGIN
  PERFORM public.jarvis_enroll_device(v_key, 'R fixture', 'windows', 'test', repeat('2', 64));
  v_device := public.jarvis_approve_device(v_user, public.jarvis_device_code(v_key));
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
  SELECT v_user, v_device, capability, true FROM unnest(ARRAY['master', 'files']) AS g(capability);
  SELECT * INTO v_task FROM public.jarvis_open_task(v_user, (SELECT c FROM r_ids), v_device, 'R', NULL, '[]');
  IF public.jarvis_set_replay(v_task.task_id, gen_random_uuid(), v_ok) THEN
    RAISE EXCEPTION 'replay: another controller set a replay';
  END IF;
  BEGIN
    PERFORM public.jarvis_set_replay(v_task.task_id, v_task.controller,
      '[{"operation":"shell.run","arguments":{"command":"del *"}}]');
    RAISE EXCEPTION 'replay: a command was put in a replay';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  IF NOT public.jarvis_set_replay(v_task.task_id, v_task.controller, v_ok) THEN
    RAISE EXCEPTION 'replay: the controller could not set a replay';
  END IF;
  IF public.jarvis_task_device(v_task.task_id) IS DISTINCT FROM v_device THEN
    RAISE EXCEPTION 'replay: wrong device';
  END IF;
  PERFORM public.jarvis_stop_task(v_user, v_task.task_id);
END $$;
ROLLBACK;
