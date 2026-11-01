-- Full request storage through the real service-only lifecycle; disposable DB only.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  account uuid := gen_random_uuid();
  conversation uuid := gen_random_uuid();
  device uuid;
  enrollment record;
  task record;
  saved text;
  rejected boolean;
  bound text;
  objective text := repeat('x', 7950) || E'\nif ready:\n    print("a  b")\n' || replace(gen_random_uuid()::text, '-', '');
BEGIN
  objective := left(objective || repeat('z', 8000), 8000);
  INSERT INTO auth.users (id, email) VALUES (account, account::text || '@example.test');
  INSERT INTO public.ocade_conversations (id, user_id, title, surface)
    VALUES (conversation, account, 'Request preservation', 'jarvis');
  SELECT * INTO enrollment FROM public.jarvis_enroll_device(
    repeat(replace(gen_random_uuid()::text, '-', ''), 4), 'Synthetic request computer',
    'linux', '0.1.0', repeat('0', 64));
  device := public.jarvis_approve_device(account, enrollment.code);
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
    VALUES (account, NULL, 'master', true), (account, device, 'files', true);
  SELECT * INTO task FROM public.jarvis_open_task(
    account, conversation, device, objective, '[{"id":"output"}]', '[]');
  SELECT title INTO saved FROM public.jarvis_tasks WHERE id = task.task_id;
  IF saved IS DISTINCT FROM objective OR length(saved) <> 8000 THEN
    RAISE EXCEPTION 'complete objective was not preserved in the task journal';
  END IF;
  PERFORM * FROM public.jarvis_stop_task(account, task.task_id);

  FOREACH bound IN ARRAY ARRAY['', '   ', repeat('x', 8001)] LOOP
    rejected := false;
    BEGIN
      PERFORM * FROM public.jarvis_open_task(account, conversation, device, bound, '[{"id":"output"}]', '[]');
    EXCEPTION WHEN check_violation THEN
      rejected := true;
    END;
    IF NOT rejected THEN
      RAISE EXCEPTION 'invalid request length % reached durable task state', length(bound);
    END IF;
  END LOOP;
  RAISE NOTICE 'Full 8000-character objective preserved; empty and over-limit negative controls refused';
END $$;
ROLLBACK;
