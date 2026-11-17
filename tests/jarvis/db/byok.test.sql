-- Plan 14B.1A/B: a customer's own model connections. Keys live in Vault only; a person reads only
-- their own connections and never the key or its reference; only a tested connection is chosen;
-- deleting a connection or the account deletes its key; a turn answered with the customer's key
-- is not charged. Disposable database only.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.byok_assert(p_ok boolean, p_what text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'byok: %', p_what; END IF;
END;
$$;
-- Vault is read here as the test's owner, never as a role the product uses.
CREATE FUNCTION pg_temp.vault_count(p_like text)
RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $$ SELECT count(*) FROM vault.secrets WHERE secret LIKE p_like $$;
GRANT EXECUTE ON FUNCTION pg_temp.vault_count(text) TO service_role;
INSERT INTO auth.users (id, email) VALUES
  ('a1a1a1a1-0000-4000-8000-000000000001', 'alice@example.test'),
  ('b0b0b0b0-0000-4000-8000-000000000002', 'bob@example.test');
CREATE TEMP TABLE ids (name text PRIMARY KEY, id uuid);
GRANT ALL ON ids TO service_role, authenticated;

SET LOCAL ROLE service_role;
INSERT INTO ids SELECT 'a1', public.ocade_byok_save('a1a1a1a1-0000-4000-8000-000000000001', NULL,
  'My OpenRouter', 'openai', 'https://openrouter.example/api/v1', 'vendor/model-a', 'sk-alice-secret-1111');
INSERT INTO ids SELECT 'a2', public.ocade_byok_save('a1a1a1a1-0000-4000-8000-000000000001', NULL,
  'Second', 'gemini', 'https://generativelanguage.googleapis.com/v1beta', 'gemini-x', 'AIza-alice-2222');
INSERT INTO ids SELECT 'b1', public.ocade_byok_save('b0b0b0b0-0000-4000-8000-000000000002', NULL,
  'Bob', 'openai', 'https://api.example/v1', 'vendor/model-b', 'sk-bob-secret-3333');
SELECT pg_temp.byok_assert((SELECT fingerprint FROM public.byok_connections WHERE id = (SELECT id FROM ids WHERE name = 'a1')) = '…1111',
  'only the last four characters are kept outside Vault');
SELECT pg_temp.byok_assert(NOT EXISTS (SELECT 1 FROM public.byok_connections c
  WHERE row_to_json(c)::text LIKE '%secret-1111%'), 'the key is not in the connection row');
SELECT pg_temp.byok_assert(pg_temp.vault_count('%') = 3, 'each key is one Vault secret');

-- An untested connection cannot be chosen; a tested one without tools cannot run JARVIS.
DO $$
BEGIN
  PERFORM public.ocade_byok_choose('a1a1a1a1-0000-4000-8000-000000000001', 'chat', (SELECT id FROM ids WHERE name = 'a1'));
  RAISE EXCEPTION 'byok: an untested connection was chosen';
EXCEPTION WHEN check_violation THEN NULL;
END;
$$;
SELECT public.ocade_byok_record('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a1'), 'connected', false, false);
SELECT public.ocade_byok_choose('a1a1a1a1-0000-4000-8000-000000000001', 'chat', (SELECT id FROM ids WHERE name = 'a1'));
DO $$
BEGIN
  PERFORM public.ocade_byok_choose('a1a1a1a1-0000-4000-8000-000000000001', 'jarvis', (SELECT id FROM ids WHERE name = 'a1'));
  RAISE EXCEPTION 'byok: a connection that cannot call tools was chosen for JARVIS';
EXCEPTION WHEN check_violation THEN NULL;
END;
$$;
SELECT pg_temp.byok_assert((SELECT secret FROM public.ocade_byok_route('a1a1a1a1-0000-4000-8000-000000000001', NULL, 'chat')) = 'sk-alice-secret-1111',
  'Chat is routed to the chosen connection');
SELECT pg_temp.byok_assert(NOT EXISTS (SELECT 1 FROM public.ocade_byok_route('a1a1a1a1-0000-4000-8000-000000000001', NULL, 'jarvis')),
  'JARVIS keeps OCADE''s models when nothing is chosen for it');
SELECT pg_temp.byok_assert(NOT EXISTS (SELECT 1 FROM public.ocade_byok_route('b0b0b0b0-0000-4000-8000-000000000002', (SELECT id FROM ids WHERE name = 'a1'), NULL)),
  'another person''s connection is never routed');
DO $$
BEGIN
  PERFORM public.ocade_byok_choose('b0b0b0b0-0000-4000-8000-000000000002', 'chat', (SELECT id FROM ids WHERE name = 'a1'));
  RAISE EXCEPTION 'byok: another person chose a connection';
EXCEPTION WHEN no_data_found THEN NULL;
END;
$$;
SELECT pg_temp.byok_assert(NOT public.ocade_byok_enable('b0b0b0b0-0000-4000-8000-000000000002', (SELECT id FROM ids WHERE name = 'a1'), false), 'another person cannot turn it off');
SELECT pg_temp.byok_assert(NOT public.ocade_byok_delete('b0b0b0b0-0000-4000-8000-000000000002', (SELECT id FROM ids WHERE name = 'a1')),
  'another person cannot delete a connection');

-- A refused key stays chosen, and is refused rather than replaced by OCADE's models.
SELECT public.ocade_byok_record('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a2'), 'connected', true, true);
SELECT public.ocade_byok_choose('a1a1a1a1-0000-4000-8000-000000000001', 'jarvis', (SELECT id FROM ids WHERE name = 'a2'));
SELECT public.ocade_byok_record('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a2'), 'invalid', NULL, NULL);
SELECT pg_temp.byok_assert((SELECT status FROM public.ocade_byok_route('a1a1a1a1-0000-4000-8000-000000000001', NULL, 'jarvis')) = 'invalid',
  'a refused key is still the chosen source, reported as refused');
SELECT public.ocade_byok_enable('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a1'), false);
SELECT pg_temp.byok_assert((SELECT NOT enabled FROM public.ocade_byok_route('a1a1a1a1-0000-4000-8000-000000000001', NULL, 'chat')),
  'a connection turned off is still the chosen source, reported as off');
SELECT public.ocade_byok_enable('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a1'), true);

-- A JARVIS task keeps the source it started with; a later choice applies to new tasks only.
RESET ROLE;
INSERT INTO public.ocade_conversations (id, user_id, title, surface)
  VALUES ('c0c0c0c0-0000-4000-8000-000000000003', 'a1a1a1a1-0000-4000-8000-000000000001', 'Task', 'jarvis');
INSERT INTO public.jarvis_tasks (id, user_id, conversation_id, title, status)
  VALUES ('c0c0c0c0-0000-4000-8000-000000000003', 'a1a1a1a1-0000-4000-8000-000000000001', 'c0c0c0c0-0000-4000-8000-000000000003', 'A task', 'running');
SELECT pg_temp.byok_assert((SELECT model_customer_key AND model_connection = (SELECT id FROM ids WHERE name = 'a2')
  FROM public.jarvis_tasks WHERE id = 'c0c0c0c0-0000-4000-8000-000000000003'), 'the task records the chosen connection');
SET LOCAL ROLE service_role;
SELECT public.ocade_acquire_generation_permit('a1a1a1a1-0000-4000-8000-000000000001', 'task-turn', 'gen-t', 'jarvis', 'free', 1000, NULL, 100);
RESET ROLE;
UPDATE public.ocade_generation_permits SET task_id = 'c0c0c0c0-0000-4000-8000-000000000003' WHERE idempotency_key = 'task-turn';
SET LOCAL ROLE service_role;
SELECT public.ocade_byok_choose('a1a1a1a1-0000-4000-8000-000000000001', 'jarvis', NULL);
SELECT pg_temp.byok_assert((SELECT id FROM public.ocade_byok_route_for_turn('a1a1a1a1-0000-4000-8000-000000000001', 'task-turn')) = (SELECT id FROM ids WHERE name = 'a2'),
  'a turn of the running task still uses the task''s own connection');
SELECT public.ocade_acquire_generation_permit('a1a1a1a1-0000-4000-8000-000000000001', 'new-turn', 'gen-n', 'jarvis', 'free', 1000, NULL, 100);
SELECT pg_temp.byok_assert(NOT EXISTS (SELECT 1 FROM public.ocade_byok_route_for_turn('a1a1a1a1-0000-4000-8000-000000000001', 'new-turn')),
  'a turn outside any task follows the current choice (OCADE''s models)');

-- A new key replaces the old one in Vault and needs a new test.
SELECT public.ocade_byok_save('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a2'),
  'Second', 'gemini', 'https://generativelanguage.googleapis.com/v1beta', 'gemini-x', 'AIza-alice-4444');
SELECT pg_temp.byok_assert((SELECT status = 'untested' AND fingerprint = '…4444' AND sees_images IS NULL
  FROM public.byok_connections WHERE id = (SELECT id FROM ids WHERE name = 'a2')), 'a replaced key is untested');
SELECT pg_temp.byok_assert(pg_temp.vault_count('%2222') = 0, 'the old key is gone');
DO $$
BEGIN
  PERFORM public.ocade_byok_save('a1a1a1a1-0000-4000-8000-000000000001', NULL, 'x', 'openai',
    'https://api.example/v1', 'm', 'has a space in it');
  RAISE EXCEPTION 'byok: a key with whitespace was kept';
EXCEPTION WHEN check_violation THEN NULL;
END;
$$;
DO $$
BEGIN
  PERFORM public.ocade_byok_save('a1a1a1a1-0000-4000-8000-000000000001', NULL, 'x', 'openai',
    'http://169.254.169.254/latest', 'm', 'sk-plain-http-0000');
  RAISE EXCEPTION 'byok: a plain-http address was kept';
EXCEPTION WHEN check_violation THEN NULL;
END;
$$;
RESET ROLE;

-- A signed-in person reads their own connections only, and never the Vault reference or key.
SET LOCAL ROLE authenticated;
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"sub": "b0b0b0b0-0000-4000-8000-000000000002", "role": "authenticated"}', true); END $$;
SELECT pg_temp.byok_assert((SELECT count(*) FROM public.byok_connections) = 1, 'Bob sees only his connection');
SELECT pg_temp.byok_assert((SELECT count(*) FROM public.byok_choices) = 0, 'Bob sees no one else''s choices');
DO $$
BEGIN
  PERFORM secret_id FROM public.byok_connections;
  RAISE EXCEPTION 'byok: the Vault reference was readable';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END;
$$;
DO $$
BEGIN
  UPDATE public.byok_connections SET status = 'connected';
  RAISE EXCEPTION 'byok: a person changed a connection directly';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END;
$$;
DO $$
BEGIN
  PERFORM public.ocade_byok_route('b0b0b0b0-0000-4000-8000-000000000002', NULL, 'chat');
  RAISE EXCEPTION 'byok: a person read a key';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END;
$$;
DO $$
BEGIN
  PERFORM 1 FROM vault.decrypted_secrets;
  RAISE EXCEPTION 'byok: a person read Vault';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END;
$$;
RESET ROLE;

-- A Chat turn answered with Alice's key draws nothing from her OCADE allowance.
SET LOCAL ROLE service_role;
INSERT INTO ids SELECT 'permit', permit_id FROM public.ocade_acquire_generation_permit(
  'a1a1a1a1-0000-4000-8000-000000000001', 'byok-turn-1', 'gen-1', 'chat', 'free', 1000, NULL, 100);
SELECT pg_temp.byok_assert(NOT public.ocade_bind_permit_to_customer_key('a1a1a1a1-0000-4000-8000-000000000001',
  'byok-turn-1', (SELECT id FROM ids WHERE name = 'a1')), 'an unclaimed permit is not bound');
SELECT public.ocade_claim_generation_transport('a1a1a1a1-0000-4000-8000-000000000001',
  (SELECT id FROM ids WHERE name = 'permit'), 'gen-1', 'byok-turn-1', 'chat');
SELECT pg_temp.byok_assert(NOT public.ocade_bind_permit_to_customer_key('a1a1a1a1-0000-4000-8000-000000000001',
  'byok-turn-1', (SELECT id FROM ids WHERE name = 'b1')), 'another person''s connection is not bound');
SELECT pg_temp.byok_assert(public.ocade_bind_permit_to_customer_key('a1a1a1a1-0000-4000-8000-000000000001',
  'byok-turn-1', (SELECT id FROM ids WHERE name = 'a1')), 'a claimed permit is bound to the key');
SELECT pg_temp.byok_assert((SELECT charged_hundredths FROM public.ocade_finalize_generation_permit(
  'a1a1a1a1-0000-4000-8000-000000000001', 'byok-turn-1', 100)) = 0, 'the customer''s key turn is not charged');

-- Deleting a connection, then the account, deletes their keys from Vault.
SELECT pg_temp.byok_assert(public.ocade_byok_delete('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a1')),
  'Alice deletes her connection');
SELECT pg_temp.byok_assert((SELECT id IS NULL FROM public.ocade_byok_route('a1a1a1a1-0000-4000-8000-000000000001', NULL, 'chat')),
  'a deleted chosen connection is refused, never quietly OCADE''s models');
SELECT public.ocade_byok_choose('a1a1a1a1-0000-4000-8000-000000000001', 'chat', NULL);
SELECT pg_temp.byok_assert(NOT EXISTS (SELECT 1 FROM public.ocade_byok_route('a1a1a1a1-0000-4000-8000-000000000001', NULL, 'chat')),
  'choosing OCADE''s models again is the person''s own step');
SELECT pg_temp.byok_assert(pg_temp.vault_count('%1111') = 0, 'its key left Vault');
RESET ROLE;
DELETE FROM auth.users WHERE id = 'a1a1a1a1-0000-4000-8000-000000000001';
SELECT pg_temp.byok_assert(pg_temp.vault_count('%') = 1, 'a deleted account leaves only Bob''s key');
ROLLBACK;
