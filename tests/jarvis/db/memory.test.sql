-- Plan 14E.1: memory is off until the person turns it on; the server reads only that person's
-- items, only while on; another person can neither read nor delete them; forgetting removes them.
-- Disposable database only.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.memory_assert(p_ok boolean, p_what text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'memory: %', p_what; END IF;
END;
$$;
INSERT INTO auth.users (id, email) VALUES
  ('a1a1a1a1-0000-4000-8000-000000000001', 'alice@example.test'),
  ('b0b0b0b0-0000-4000-8000-000000000002', 'bob@example.test');
SET LOCAL ROLE authenticated;
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"sub": "a1a1a1a1-0000-4000-8000-000000000001", "role": "authenticated"}', true); END $$;
INSERT INTO public.jarvis_memories (user_id, content) VALUES
  ('a1a1a1a1-0000-4000-8000-000000000001', 'ALICE-CANARY prefers metric units');
DO $$
BEGIN
  INSERT INTO public.jarvis_memories (user_id, content) VALUES ('b0b0b0b0-0000-4000-8000-000000000002', 'planted');
  RAISE EXCEPTION 'memory: Alice wrote into Bob''s memory';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END;
$$;
DO $$
BEGIN
  INSERT INTO public.jarvis_memories (user_id, content, source) VALUES ('a1a1a1a1-0000-4000-8000-000000000001', 'x', 'inferred');
  RAISE EXCEPTION 'memory: an inferred item was kept';
EXCEPTION WHEN check_violation THEN NULL;
END;
$$;
DO $$
BEGIN
  PERFORM public.ocade_memories_for_turn('a1a1a1a1-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'memory: a signed-in person used the server read';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END;
$$;
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT pg_temp.memory_assert(public.ocade_memories_for_turn('a1a1a1a1-0000-4000-8000-000000000001') = '{}',
  'memory is off until the person turns it on');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT pg_temp.memory_assert(public.ocade_set_memory_enabled(true), 'Alice turns her memory on');
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"sub": "b0b0b0b0-0000-4000-8000-000000000002", "role": "authenticated"}', true); END $$;
SELECT pg_temp.memory_assert((SELECT count(*) FROM public.jarvis_memories) = 0, 'Bob reads none of Alice''s memory');
DELETE FROM public.jarvis_memories;
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT pg_temp.memory_assert(public.ocade_memories_for_turn('a1a1a1a1-0000-4000-8000-000000000001') = ARRAY['ALICE-CANARY prefers metric units'],
  'Alice''s turn reads her item; Bob''s delete removed nothing');
SELECT pg_temp.memory_assert(public.ocade_memories_for_turn('b0b0b0b0-0000-4000-8000-000000000002') = '{}',
  'Bob''s turn reads nothing of Alice''s');
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"sub": "a1a1a1a1-0000-4000-8000-000000000001", "role": "authenticated"}', true); END $$;
SELECT pg_temp.memory_assert(NOT public.ocade_set_memory_enabled(false), 'Alice turns it off');
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT pg_temp.memory_assert(public.ocade_memories_for_turn('a1a1a1a1-0000-4000-8000-000000000001') = '{}',
  'off stops its use at once');
RESET ROLE;
ROLLBACK;
