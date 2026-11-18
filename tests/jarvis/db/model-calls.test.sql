-- Plan 14B.1B.3: each answered turn is recorded once with the source that paid for it. A customer
-- turn is recorded only against that customer's own connection; a person reads their own records
-- without OCADE's key slot and can change none; no one but the server writes. Disposable only.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.calls_assert(p_ok boolean, p_what text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'model calls: %', p_what; END IF;
END;
$$;
INSERT INTO auth.users (id, email) VALUES
  ('a1a1a1a1-0000-4000-8000-000000000001', 'alice@example.test'),
  ('b0b0b0b0-0000-4000-8000-000000000002', 'bob@example.test');
CREATE TEMP TABLE conn AS SELECT public.ocade_byok_save('a1a1a1a1-0000-4000-8000-000000000001', NULL,
  'Alice', 'openai', 'https://api.example.com/v1', 'vendor/m', 'sk-alice-0000-1111') AS id;
GRANT SELECT ON conn TO service_role, authenticated;
SET LOCAL ROLE service_role;
SELECT public.ocade_record_model_call('a1a1a1a1-0000-4000-8000-000000000001', 'chat', 'customer',
  (SELECT id::text FROM conn), 'vendor/m', 120, 30);
SELECT public.ocade_record_model_call('a1a1a1a1-0000-4000-8000-000000000001', 'jarvis', 'ocade',
  'owner:key-7', 'gemini-x', 900, 40);
-- Bob's turn cannot be charged to Alice's connection.
SELECT public.ocade_record_model_call('b0b0b0b0-0000-4000-8000-000000000002', 'chat', 'customer',
  (SELECT id::text FROM conn), 'vendor/m', 1, 1);
SELECT pg_temp.calls_assert((SELECT count(*) FROM public.model_calls) = 2, 'two records, none for Bob on Alice''s key');
SELECT pg_temp.calls_assert((SELECT count(*) FROM public.model_calls WHERE source = 'customer' AND connection_id = (SELECT id FROM conn)) = 1,
  'the customer turn names her connection');
DO $$
BEGIN
  INSERT INTO public.model_calls (user_id, surface, source, key_slot, model)
  VALUES ('a1a1a1a1-0000-4000-8000-000000000001', 'chat', 'ocade', 'primary', 'm');
  RAISE EXCEPTION 'model calls: the server wrote around the recording function';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END;
$$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"sub": "a1a1a1a1-0000-4000-8000-000000000001", "role": "authenticated"}', true); END $$;
SELECT pg_temp.calls_assert((SELECT count(*) FROM public.model_calls) = 2, 'Alice reads her two records');
DO $$
BEGIN
  PERFORM key_slot FROM public.model_calls;
  RAISE EXCEPTION 'model calls: a person read OCADE''s key slot';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END;
$$;
DO $$
BEGIN
  DELETE FROM public.model_calls;
  RAISE EXCEPTION 'model calls: a person deleted a record';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END;
$$;
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"sub": "b0b0b0b0-0000-4000-8000-000000000002", "role": "authenticated"}', true); END $$;
SELECT pg_temp.calls_assert((SELECT count(*) FROM public.model_calls) = 0, 'Bob reads none of Alice''s');
RESET ROLE;
ROLLBACK;
