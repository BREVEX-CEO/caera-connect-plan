-- OFFLINE-03: a retried create (insert ... on conflict (id) do nothing, as the client sends it) keeps a title
-- renamed since, and an id that belongs to another account is left alone. Disposable DB only.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE TEMP TABLE cc_ids AS SELECT gen_random_uuid() AS a, gen_random_uuid() AS b, gen_random_uuid() AS conv;
INSERT INTO auth.users (id, email) SELECT a, a::text || '@example.test' FROM cc_ids;
INSERT INTO auth.users (id, email) SELECT b, b::text || '@example.test' FROM cc_ids;
GRANT SELECT ON cc_ids TO authenticated;
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_a uuid := (SELECT a FROM cc_ids);
  v_b uuid := (SELECT b FROM cc_ids);
  v_conv uuid := (SELECT conv FROM cc_ids);
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  INSERT INTO public.ocade_conversations (id, user_id, title) VALUES (v_conv, v_a, 'Offline title')
    ON CONFLICT (id) DO NOTHING;
  UPDATE public.ocade_conversations SET title = 'Renamed elsewhere' WHERE id = v_conv;
  INSERT INTO public.ocade_conversations (id, user_id, title) VALUES (v_conv, v_a, 'Offline title')
    ON CONFLICT (id) DO NOTHING;
  IF (SELECT title FROM public.ocade_conversations WHERE id = v_conv) <> 'Renamed elsewhere' THEN
    RAISE EXCEPTION 'create-retry: a retried create overwrote the newer title';
  END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  INSERT INTO public.ocade_conversations (id, user_id, title) VALUES (v_conv, v_b, 'Mine now')
    ON CONFLICT (id) DO NOTHING;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  IF (SELECT title FROM public.ocade_conversations WHERE id = v_conv) <> 'Renamed elsewhere'
     OR (SELECT user_id FROM public.ocade_conversations WHERE id = v_conv) <> v_a THEN
    RAISE EXCEPTION 'create-retry: another account changed or took the conversation';
  END IF;
END $$;
ROLLBACK;
