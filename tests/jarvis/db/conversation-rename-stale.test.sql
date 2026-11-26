-- OFFLINE-03: a rename made from an out-of-date copy is refused and changes nothing; any writer that
-- changes a title bumps its revision; another account's conversation cannot be renamed. Disposable DB only.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE TEMP TABLE cr_ids AS SELECT gen_random_uuid() AS a, gen_random_uuid() AS b, gen_random_uuid() AS conv;
INSERT INTO auth.users (id, email) SELECT a, a::text || '@example.test' FROM cr_ids;
INSERT INTO auth.users (id, email) SELECT b, b::text || '@example.test' FROM cr_ids;
INSERT INTO public.ocade_conversations (id, user_id, title) SELECT conv, a, 'First' FROM cr_ids;
GRANT SELECT ON cr_ids TO authenticated;
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_a uuid := (SELECT a FROM cr_ids);
  v_b uuid := (SELECT b FROM cr_ids);
  v_conv uuid := (SELECT conv FROM cr_ids);
  r1 integer;
  r2 integer;
  refused boolean := false;
  foreign_refused boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  IF (SELECT title_revision FROM public.ocade_conversations WHERE id = v_conv) <> 0 THEN
    RAISE EXCEPTION 'stale-rename: a new conversation must start at revision 0';
  END IF;
  r1 := public.ocade_rename_conversation_checked(v_conv, 0, 'Second');
  IF r1 <> 1 THEN RAISE EXCEPTION 'stale-rename: first rename revision % (want 1)', r1; END IF;
  r2 := public.ocade_rename_conversation_checked(v_conv, 1, 'Third');
  IF r2 <> 2 THEN RAISE EXCEPTION 'stale-rename: current rename revision % (want 2)', r2; END IF;
  -- the other device still holds revision 1
  BEGIN
    PERFORM public.ocade_rename_conversation_checked(v_conv, 1, 'Stale');
  EXCEPTION WHEN serialization_failure THEN refused := true;
  END;
  IF NOT refused THEN RAISE EXCEPTION 'stale-rename: a rename from revision 1 was accepted at revision 2'; END IF;
  IF (SELECT title FROM public.ocade_conversations WHERE id = v_conv) <> 'Third'
     OR (SELECT title_revision FROM public.ocade_conversations WHERE id = v_conv) <> 2 THEN
    RAISE EXCEPTION 'stale-rename: a refused rename changed the stored row';
  END IF;
  -- an older client's plain update still counts as a title change
  UPDATE public.ocade_conversations SET title = 'Plain' WHERE id = v_conv;
  IF (SELECT title_revision FROM public.ocade_conversations WHERE id = v_conv) <> 3 THEN
    RAISE EXCEPTION 'stale-rename: a plain title update did not bump the revision';
  END IF;
  -- a change to something other than the title does not
  UPDATE public.ocade_conversations SET pinned = true WHERE id = v_conv;
  IF (SELECT title_revision FROM public.ocade_conversations WHERE id = v_conv) <> 3 THEN
    RAISE EXCEPTION 'stale-rename: pinning bumped the title revision';
  END IF;
  -- the same title again changes nothing
  UPDATE public.ocade_conversations SET title = 'Plain' WHERE id = v_conv;
  IF (SELECT title_revision FROM public.ocade_conversations WHERE id = v_conv) <> 3 THEN
    RAISE EXCEPTION 'stale-rename: an unchanged title bumped the revision';
  END IF;
  -- another account cannot rename it, and cannot tell it exists
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.ocade_rename_conversation_checked(v_conv, 3, 'Mine now');
  EXCEPTION WHEN no_data_found THEN foreign_refused := true;
  END;
  IF NOT foreign_refused THEN RAISE EXCEPTION 'stale-rename: another account renamed this conversation'; END IF;
  IF (SELECT title FROM public.ocade_conversations WHERE id = v_conv) IS NOT NULL THEN
    RAISE EXCEPTION 'stale-rename: another account can read the conversation';
  END IF;
END;
$$;
RESET ROLE;
ROLLBACK;
