-- C9: a task sees the routes of this person's earlier tasks on the same computer that passed
-- their checks, newest first, as operation and app or site only. Another person's tasks,
-- another computer's, unfinished ones and the task itself are never shown.
-- Disposable database only; every account/device is synthetic.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.experience_assert(p_ok boolean, p_what text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'experience: %', p_what; END IF;
END;
$$;
CREATE TEMP TABLE experience_ids AS
SELECT gen_random_uuid() AS user_id, gen_random_uuid() AS other_user, gen_random_uuid() AS conversation_id,
       gen_random_uuid() AS other_conversation;
INSERT INTO auth.users (id, email) SELECT user_id, user_id::text || '@example.test' FROM experience_ids;
INSERT INTO auth.users (id, email) SELECT other_user, other_user::text || '@example.test' FROM experience_ids;
INSERT INTO public.ocade_conversations (id, user_id, title, surface)
SELECT conversation_id, user_id, 'Experience fixture', 'jarvis' FROM experience_ids;
INSERT INTO public.ocade_conversations (id, user_id, title, surface)
SELECT other_conversation, other_user, 'Experience fixture', 'jarvis' FROM experience_ids;
CREATE TEMP TABLE experience_tasks (name text PRIMARY KEY, task_id uuid);
GRANT SELECT ON experience_ids, experience_tasks TO service_role;
GRANT INSERT ON experience_tasks TO service_role;

SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_user uuid := (SELECT user_id FROM experience_ids);
  v_other uuid := (SELECT other_user FROM experience_ids);
  v_device uuid;
  v_second uuid;
  v_foreign uuid;
  v_case record;
BEGIN
  PERFORM public.jarvis_enroll_device(repeat('a1', 64), 'Experience PC', 'windows', 'test', repeat('c', 64));
  v_device := public.jarvis_approve_device(v_user, public.jarvis_device_code(repeat('a1', 64)));
  PERFORM public.jarvis_enroll_device(repeat('b2', 64), 'Second PC', 'windows', 'test', repeat('d', 64));
  v_second := public.jarvis_approve_device(v_user, public.jarvis_device_code(repeat('b2', 64)));
  PERFORM public.jarvis_enroll_device(repeat('e3', 64), 'Foreign PC', 'windows', 'test', repeat('e', 64));
  v_foreign := public.jarvis_approve_device(v_other, public.jarvis_device_code(repeat('e3', 64)));
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
  SELECT d.owner, d.device, g.capability, true
    FROM (VALUES (v_user, v_device), (v_user, v_second), (v_other, v_foreign)) AS d(owner, device)
   CROSS JOIN unnest(ARRAY['master', 'files']) AS g(capability);
  FOR v_case IN SELECT * FROM (VALUES
    ('older', v_user, v_device, (SELECT conversation_id FROM experience_ids), 'Total the March invoices'),
    ('newer', v_user, v_device, (SELECT conversation_id FROM experience_ids), 'Total the April invoices'),
    ('open', v_user, v_device, (SELECT conversation_id FROM experience_ids), 'Unfinished work'),
    ('elsewhere', v_user, v_second, (SELECT conversation_id FROM experience_ids), 'On the second computer'),
    ('foreign', v_other, v_foreign, (SELECT other_conversation FROM experience_ids), 'Someone else'),
    ('current', v_user, v_device, (SELECT conversation_id FROM experience_ids), 'Total the May invoices')
  ) AS cases(name, owner, device, conversation, title) LOOP
    INSERT INTO experience_tasks
    SELECT v_case.name, task_id FROM public.jarvis_open_task(v_case.owner, v_case.conversation, v_case.device,
                                                             v_case.title, NULL, '[]');
    IF v_case.name = 'open' THEN
      PERFORM public.jarvis_stop_task(v_case.owner, (SELECT task_id FROM experience_tasks WHERE name = v_case.name));
    ELSIF v_case.name <> 'current' THEN
      INSERT INTO public.jarvis_activity (user_id, task_id, device_id, summary, action, status, created_at)
      SELECT t.user_id, t.id, t.device_id, st.summary,
             jsonb_build_object('v', 1, 'key', st.key, 'operation', st.operation, 'arguments', '{}'::jsonb)
               || CASE WHEN st.app IS NULL THEN '{}'::jsonb
                       ELSE jsonb_build_object('target', jsonb_build_object('app', st.app)) END,
             st.status, now() + st.at
        FROM public.jarvis_tasks AS t
       CROSS JOIN (VALUES
         ('s1', 'apps.launch', 'excel.exe', 'done', interval '1 second', 'Open'),
         ('s2', 'ui.inspect', 'excel.exe', 'done', interval '2 seconds', 'Look'),
         ('s3', 'ui.invoke', 'excel.exe', 'failed', interval '3 seconds', 'Missed'),
         ('s4', 'verify.checks', NULL, 'done', interval '4 seconds', 'Check')
       ) AS st(key, operation, app, status, at, summary)
       WHERE t.id = (SELECT task_id FROM experience_tasks WHERE name = v_case.name);
      -- Finished as the authority would leave it (the settle path itself is tested elsewhere).
      UPDATE public.jarvis_tasks SET status = 'completed', controller = NULL, verified_actions = 4,
             finished_at = now() - CASE v_case.name WHEN 'older' THEN interval '2 days' ELSE interval '1 day' END
       WHERE id = (SELECT task_id FROM experience_tasks WHERE name = v_case.name);
    END IF;
  END LOOP;
END;
$$;
DO $$
DECLARE
  v_seen jsonb := public.jarvis_experience((SELECT task_id FROM experience_tasks WHERE name = 'current'));
BEGIN
  PERFORM pg_temp.experience_assert(jsonb_array_length(v_seen) = 2, format('only the two finished tasks here: %s', v_seen));
  PERFORM pg_temp.experience_assert(v_seen -> 0 ->> 'title' = 'Total the April invoices', format('newest first: %s', v_seen));
  PERFORM pg_temp.experience_assert(
    v_seen -> 0 -> 'route' = '["apps.launch excel.exe", "ui.inspect excel.exe", "verify.checks"]'::jsonb,
    format('done steps only, in order, operation and app: %s', v_seen -> 0 -> 'route'));
  PERFORM pg_temp.experience_assert(NOT v_seen::text LIKE '%Someone else%' AND NOT v_seen::text LIKE '%second computer%'
                                    AND NOT v_seen::text LIKE '%Unfinished%' AND NOT v_seen::text LIKE '%May%',
                                    format('nothing from another person, computer, open task or itself: %s', v_seen));
END;
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.jarvis_experience(gen_random_uuid());
  RAISE EXCEPTION 'experience: a signed-in client may not read routes';
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END;
$$;
ROLLBACK;
