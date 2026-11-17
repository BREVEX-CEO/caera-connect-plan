-- Plan v8 10.8: a provider refusal is remembered for the server only, renewed when learned again,
-- and forgotten after 30 days. Disposable database only.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.refusal_assert(p_ok boolean, p_what text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'provider refusals: %', p_what; END IF;
END;
$$;
SET LOCAL ROLE service_role;
SELECT public.ocade_learn_provider_refusal('example.test/model-a', 'thinking');
SELECT public.ocade_learn_provider_refusal('example.test/model-a', 'thinking');
SELECT public.ocade_learn_provider_refusal('example.test/model-a', 'forced_call');
SELECT public.ocade_learn_provider_refusal('example.test/model-c', 'vision');
SELECT pg_temp.refusal_assert(public.ocade_provider_refusals('example.test/model-c') = ARRAY['vision'],
  'a model that refused images is remembered as text-only');
SELECT pg_temp.refusal_assert(public.ocade_provider_refusals('example.test/model-a') = ARRAY['forced_call', 'thinking'],
  'both learned settings are read back once each');
SELECT pg_temp.refusal_assert(public.ocade_provider_refusals('example.test/model-b') = '{}', 'another model refused nothing');
RESET ROLE;
UPDATE private.provider_refusals SET learned_at = now() - interval '31 days' WHERE feature = 'thinking';
SET LOCAL ROLE service_role;
SELECT pg_temp.refusal_assert(public.ocade_provider_refusals('example.test/model-a') = ARRAY['forced_call'],
  'a refusal older than 30 days is asked again');
DO $$
BEGIN
  PERFORM public.ocade_learn_provider_refusal('example.test/model-a', 'anything');
  RAISE EXCEPTION 'provider refusals: an unknown setting was stored';
EXCEPTION WHEN check_violation THEN NULL;
END;
$$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.ocade_provider_refusals('example.test/model-a');
  RAISE EXCEPTION 'provider refusals: a signed-in person read the record';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END;
$$;
ROLLBACK;
