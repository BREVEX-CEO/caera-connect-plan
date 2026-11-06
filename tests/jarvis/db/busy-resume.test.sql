-- D10: a task that waited only for a busy planner resumes by itself when due; a task waiting
-- for anything else never does. Disposable database only; every account/device is synthetic.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.busy_assert(p_ok boolean, p_what text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'busy resume: %', p_what; END IF;
END;
$$;
CREATE TEMP TABLE busy_ids AS SELECT gen_random_uuid() AS user_id, gen_random_uuid() AS conversation_id;
INSERT INTO auth.users (id, email) SELECT user_id, user_id::text || '@example.test' FROM busy_ids;
INSERT INTO public.ocade_conversations (id, user_id, title, surface)
SELECT conversation_id, user_id, 'Busy fixture', 'jarvis' FROM busy_ids;
GRANT SELECT ON busy_ids TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_user uuid := (SELECT user_id FROM busy_ids);
  v_key text := repeat(replace(v_user::text, '-', ''), 4);
  v_device uuid;
  v_task record;
  v_controller uuid;
  v_samples jsonb;
  v_timing jsonb;
BEGIN
  PERFORM public.jarvis_enroll_device(v_key, 'Busy fixture', 'windows', 'test', repeat('a', 64));
  v_device := public.jarvis_approve_device(v_user, public.jarvis_device_code(v_key));
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
  SELECT v_user, v_device, capability, true FROM unnest(ARRAY['master', 'files']) AS grants(capability);
  SELECT * INTO v_task FROM public.jarvis_open_task(v_user, (SELECT conversation_id FROM busy_ids), v_device,
                                                    'Busy fixture', NULL, '[]');

  v_samples := jsonb_build_array(
    jsonb_build_object('call', repeat('a', 64), 'ms', 17, 'input', 0, 'output', 8),
    jsonb_build_object('call', repeat('b', 64), 'ms', 33, 'input', NULL, 'output', NULL)
  );
  PERFORM public.jarvis_note_model_metrics(v_task.task_id, 'goal', v_samples);
  PERFORM public.jarvis_note_model_metrics(v_task.task_id, 'goal', v_samples);
  v_timing := public.jarvis_task_state(v_task.task_id) -> 'timing';
  PERFORM pg_temp.busy_assert(v_timing ->> 'modelCalls' = '2' AND v_timing ->> 'modelMs' = '50',
                              'replayed samples do not count twice');
  PERFORM pg_temp.busy_assert(v_timing #>> '{providerUsage,inputMeasuredCalls}' = '1'
                          AND v_timing #>> '{providerUsage,inputTokens}' = '0'
                          AND v_timing #>> '{providerUsage,outputTokens}' = '8'
                          AND v_timing #>> '{providerUsage,goalMs}' = '50',
                              'zero, missing and reported usage remain distinct');

  PERFORM public.jarvis_task_wait_until(v_task.task_id, v_task.controller, 'busy', now() + interval '1 hour');
  PERFORM pg_temp.busy_assert(public.jarvis_resume_due(v_device) IS NULL, 'not before its retry time');

  UPDATE public.jarvis_tasks SET retry_at = now() - interval '1 second' WHERE id = v_task.task_id;
  PERFORM pg_temp.busy_assert(public.jarvis_resume_due(v_device) = v_task.task_id, 'resumes when due');
  SELECT t.controller INTO v_controller FROM public.jarvis_tasks AS t WHERE t.id = v_task.task_id;
  PERFORM pg_temp.busy_assert((SELECT status = 'running' AND retry_at IS NULL AND controller <> v_task.controller
                                 FROM public.jarvis_tasks WHERE id = v_task.task_id),
                              'running under a new controller, retry time cleared');

  -- Busy, then waiting for something else (an uncertain step): never resumed by itself.
  PERFORM public.jarvis_task_wait_until(v_task.task_id, v_controller, 'busy', now() - interval '1 second');
  PERFORM public.jarvis_resume_task(v_user, v_task.task_id);
  SELECT t.controller INTO v_controller FROM public.jarvis_tasks AS t WHERE t.id = v_task.task_id;
  PERFORM public.jarvis_task_wait(v_task.task_id, v_controller, 'checking whether a step took effect');
  PERFORM pg_temp.busy_assert((SELECT retry_at IS NULL FROM public.jarvis_tasks WHERE id = v_task.task_id),
                              'another kind of wait clears the retry time');
  PERFORM pg_temp.busy_assert(public.jarvis_resume_due(v_device) IS NULL, 'a person-gated wait is never resumed');

  PERFORM public.jarvis_resume_task(v_user, v_task.task_id);
  SELECT t.controller INTO v_controller FROM public.jarvis_tasks AS t WHERE t.id = v_task.task_id;
  PERFORM public.jarvis_task_wait_until(v_task.task_id, v_controller, 'busy', now() - interval '1 second');
  PERFORM pg_temp.busy_assert(public.jarvis_resume_due(v_device) = v_task.task_id, 'third busy retry can run');
  SELECT t.controller INTO v_controller FROM public.jarvis_tasks AS t WHERE t.id = v_task.task_id;
  PERFORM public.jarvis_task_wait_until(v_task.task_id, v_controller, 'busy', now() - interval '1 second');
  PERFORM pg_temp.busy_assert(public.jarvis_resume_due(v_device) IS NULL, 'retry budget ends automatic work');
  PERFORM pg_temp.busy_assert((SELECT planner_auto_retries = 3 AND retry_at IS NULL AND status = 'waiting'
                                 FROM public.jarvis_tasks WHERE id = v_task.task_id),
                              'task can still be resumed by its owner');
END;
$$;
ROLLBACK;
