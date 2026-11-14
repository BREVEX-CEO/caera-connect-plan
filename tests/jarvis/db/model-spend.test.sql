-- Plan v8 10.5: the tokens counted for the spending ceilings are this account's own since the
-- given moment, or every account's when none is named; only the server may read them.
-- Disposable database only; every account/device is synthetic.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.spend_assert(p_ok boolean, p_what text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'model spend: %', p_what; END IF;
END;
$$;
CREATE TEMP TABLE spend_ids AS
SELECT gen_random_uuid() AS a, gen_random_uuid() AS b, gen_random_uuid() AS ca, gen_random_uuid() AS cb;
INSERT INTO auth.users (id, email) SELECT a, a::text || '@example.test' FROM spend_ids;
INSERT INTO auth.users (id, email) SELECT b, b::text || '@example.test' FROM spend_ids;
INSERT INTO public.ocade_conversations (id, user_id, title, surface) SELECT ca, a, 'Spend', 'jarvis' FROM spend_ids;
INSERT INTO public.ocade_conversations (id, user_id, title, surface) SELECT cb, b, 'Spend', 'jarvis' FROM spend_ids;
CREATE TEMP TABLE spend_tasks (owner uuid, task_id uuid);
GRANT SELECT ON spend_ids TO service_role;
GRANT SELECT, INSERT ON spend_tasks TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_a uuid := (SELECT a FROM spend_ids);
  v_b uuid := (SELECT b FROM spend_ids);
  v_ca uuid := (SELECT ca FROM spend_ids);
  v_cb uuid := (SELECT cb FROM spend_ids);
  v_device uuid;
  v_task record;
BEGIN
  PERFORM public.jarvis_enroll_device(repeat('e1', 64), 'Spend A', 'windows', 'test', repeat('e', 64));
  v_device := public.jarvis_approve_device(v_a, public.jarvis_device_code(repeat('e1', 64)));
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
  SELECT v_a, v_device, capability, true FROM unnest(ARRAY['master', 'files']) AS grants(capability);
  SELECT * INTO v_task FROM public.jarvis_open_task(v_a, v_ca, v_device, 'Spend one', NULL, '[]');
  INSERT INTO spend_tasks VALUES (v_a, v_task.task_id);
  PERFORM public.jarvis_stop_task(v_a, v_task.task_id);
  SELECT * INTO v_task FROM public.jarvis_open_task(v_a, v_ca, v_device, 'Spend two', NULL, '[]');
  INSERT INTO spend_tasks VALUES (v_a, v_task.task_id);
  PERFORM public.jarvis_enroll_device(repeat('f2', 64), 'Spend B', 'windows', 'test', repeat('f', 64));
  v_device := public.jarvis_approve_device(v_b, public.jarvis_device_code(repeat('f2', 64)));
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
  SELECT v_b, v_device, capability, true FROM unnest(ARRAY['master', 'files']) AS grants(capability);
  SELECT * INTO v_task FROM public.jarvis_open_task(v_b, v_cb, v_device, 'Spend other', NULL, '[]');
  INSERT INTO spend_tasks VALUES (v_b, v_task.task_id);
END;
$$;
RESET ROLE;
-- The provider's reported counts, as jarvis_note_model_metrics would have recorded them.
UPDATE public.jarvis_tasks SET provider_input_tokens = 1000, provider_output_tokens = 100
 WHERE id IN (SELECT task_id FROM spend_tasks);
UPDATE public.jarvis_tasks SET created_at = now() - interval '2 days'
 WHERE title = 'Spend one';
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_a uuid := (SELECT a FROM spend_ids);
  v_since timestamptz := now() - interval '1 day';
BEGIN
  PERFORM pg_temp.spend_assert(public.jarvis_model_tokens(v_a, v_since) = '{"input": 1000, "output": 100}',
                               'only this account since the moment');
  PERFORM pg_temp.spend_assert(public.jarvis_model_tokens(v_a, now() - interval '3 days') = '{"input": 2000, "output": 200}',
                               'an earlier moment counts the older task too');
  PERFORM pg_temp.spend_assert((public.jarvis_model_tokens(NULL, v_since) ->> 'input')::bigint >= 2000,
                               'every account when none is named');
  PERFORM pg_temp.spend_assert(
    NOT has_function_privilege('authenticated', 'public.jarvis_model_tokens(uuid,timestamptz)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.jarvis_model_tokens(uuid,timestamptz)', 'EXECUTE'),
    'only the server reads spend');
END;
$$;
ROLLBACK;
