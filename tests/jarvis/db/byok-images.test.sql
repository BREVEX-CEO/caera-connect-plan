-- BYOK-07: a person chooses, per key, whether pictures may go to their own provider. Off means
-- the route reports the model as unable to see, whatever its test found. Only the owner can
-- change it, and only that one setting. Disposable database only.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.ok(p_ok boolean, p_what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'byok images: %', p_what; END IF;
END;
$$;
INSERT INTO auth.users (id, email) VALUES
  ('a1a1a1a1-0000-4000-8000-0000000000a1', 'alice-images@example.test'),
  ('b0b0b0b0-0000-4000-8000-0000000000b2', 'bob-images@example.test');
CREATE TEMP TABLE ids (name text PRIMARY KEY, id uuid);
GRANT ALL ON ids TO service_role, authenticated;

SET LOCAL ROLE service_role;
INSERT INTO ids SELECT 'a', public.ocade_byok_save('a1a1a1a1-0000-4000-8000-0000000000a1', NULL,
  'Alice', 'openai', 'https://api.example/v1', 'vendor/sees', 'sk-alice-images-1111');
SELECT public.ocade_byok_record('a1a1a1a1-0000-4000-8000-0000000000a1', (SELECT id FROM ids WHERE name = 'a'),
  'connected', true, true);
SELECT public.ocade_byok_choose('a1a1a1a1-0000-4000-8000-0000000000a1', 'chat', (SELECT id FROM ids WHERE name = 'a'));
SELECT pg_temp.ok((SELECT sees_images FROM public.ocade_byok_route('a1a1a1a1-0000-4000-8000-0000000000a1', NULL, 'chat')),
  'a tested model that sees, with pictures allowed, sees');
RESET ROLE;

-- Bob cannot change Alice's choice.
SET LOCAL ROLE authenticated;
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"sub": "b0b0b0b0-0000-4000-8000-0000000000b2", "role": "authenticated"}', true); END $$;
UPDATE public.byok_connections SET send_images = false;
RESET ROLE;
SELECT pg_temp.ok((SELECT send_images FROM public.byok_connections WHERE id = (SELECT id FROM ids WHERE name = 'a')),
  'another person changed the choice');

-- Alice turns pictures off; she cannot change anything else.
SET LOCAL ROLE authenticated;
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"sub": "a1a1a1a1-0000-4000-8000-0000000000a1", "role": "authenticated"}', true); END $$;
UPDATE public.byok_connections SET send_images = false;
DO $$
BEGIN
  UPDATE public.byok_connections SET sees_images = true;
  RAISE EXCEPTION 'byok images: the owner changed a tested capability directly';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END;
$$;
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT pg_temp.ok((SELECT sees_images FROM public.ocade_byok_route('a1a1a1a1-0000-4000-8000-0000000000a1', NULL, 'chat')) IS FALSE,
  'pictures off: the chosen route does not see');
SELECT pg_temp.ok((SELECT sees_images FROM public.ocade_byok_route('a1a1a1a1-0000-4000-8000-0000000000a1',
  (SELECT id FROM ids WHERE name = 'a'), NULL)) IS FALSE, 'pictures off: the named connection does not see');
RESET ROLE;

ROLLBACK;
