-- Plan 14B.1A.1: the owner registers any number of provider keys (here 120) without a code change;
-- each is one Vault secret; only enabled keys for the host and model come back, in order; a
-- replaced key keeps its label; deleting a key deletes its secret; no signed-in person or service
-- caller can register or read keys except through the server-only read. Disposable database only.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.keys_assert(p_ok boolean, p_what text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'owner keys: %', p_what; END IF;
END;
$$;
SELECT public.ocade_owner_add_model_key('key-' || n, 'generativelanguage.googleapis.com',
  'project-' || (n % 3), 'AIza-synthetic-' || lpad(n::text, 4, '0'), n)
  FROM generate_series(1, 120) AS n;
SELECT public.ocade_owner_add_model_key('other-host', 'api.example.com', 'p', 'sk-synthetic-other');
SELECT public.ocade_owner_add_model_key('one-model', 'generativelanguage.googleapis.com', 'p',
  'AIza-synthetic-only', 0, ARRAY['gemini-x']);
SELECT pg_temp.keys_assert((SELECT count(*) FROM vault.secrets WHERE name LIKE 'owner-model-key:%') = 122,
  'each key is one Vault secret');
SET LOCAL ROLE service_role;
SELECT pg_temp.keys_assert((SELECT count(*) FROM public.ocade_owner_model_keys('generativelanguage.googleapis.com', 'gemini-y')) = 120,
  'all 120 keys for the host are served');
SELECT pg_temp.keys_assert((SELECT label FROM public.ocade_owner_model_keys('generativelanguage.googleapis.com', 'gemini-x') LIMIT 1) = 'one-model',
  'a key limited to a model is served for it, first by priority');
SELECT pg_temp.keys_assert((SELECT array_agg(label) FROM public.ocade_owner_model_keys('api.example.com', 'm')) = ARRAY['other-host'],
  'another host''s keys are not mixed in');
DO $$
BEGIN
  PERFORM public.ocade_owner_add_model_key('intruder', 'api.example.com', 'p', 'sk-intruder-0000');
  RAISE EXCEPTION 'owner keys: the service role registered a key';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END;
$$;
RESET ROLE;
SELECT public.ocade_owner_set_model_key('key-1', false);
SELECT public.ocade_owner_add_model_key('key-2', 'generativelanguage.googleapis.com', 'project-2', 'AIza-synthetic-new2', 2);
SET LOCAL ROLE service_role;
SELECT pg_temp.keys_assert(NOT EXISTS (SELECT 1 FROM public.ocade_owner_model_keys('generativelanguage.googleapis.com', 'g') WHERE label = 'key-1'),
  'a suspended key is not served');
SELECT pg_temp.keys_assert((SELECT secret FROM public.ocade_owner_model_keys('generativelanguage.googleapis.com', 'g') WHERE label = 'key-2') = 'AIza-synthetic-new2',
  'a replaced key is served under its label');
RESET ROLE;
DELETE FROM private.owner_model_keys WHERE label = 'key-3';
SELECT pg_temp.keys_assert(NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'owner-model-key:key-3'),
  'deleting a key deletes its secret');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.ocade_owner_model_keys('generativelanguage.googleapis.com', 'g');
  RAISE EXCEPTION 'owner keys: a signed-in person read the keys';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END;
$$;
DO $$
BEGIN
  PERFORM 1 FROM private.owner_model_keys;
  RAISE EXCEPTION 'owner keys: a signed-in person read the registry';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END;
$$;
RESET ROLE;
ROLLBACK;
