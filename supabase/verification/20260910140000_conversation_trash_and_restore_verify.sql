-- Verifies 20260910140000_conversation_trash_and_restore.sql.

DO $$
DECLARE
  probe_user uuid := gen_random_uuid();
  fresh uuid;
  lapsed uuid;
  kept uuid;
  removed integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'ocade_conversations'
       AND column_name = 'deleted_at'
  ) THEN
    RAISE EXCEPTION 'ocade_conversations has no deleted_at, so a delete is still permanent with no undo';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'ocade_conversations_trash_idx'
      AND relnamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'the trash has no covering index, so reading it scans every conversation on the account';
  END IF;

  IF public.ocade_conversation_trash_days() <> 30 THEN
    RAISE EXCEPTION 'the undo period is % days rather than 30', public.ocade_conversation_trash_days();
  END IF;

  INSERT INTO auth.users (id, email) VALUES (probe_user, 'trash-probe-' || probe_user || '@invalid.test');
  INSERT INTO public.ocade_conversations (user_id, title, deleted_at)
    VALUES (probe_user, 'Trashed today', now()) RETURNING id INTO fresh;
  INSERT INTO public.ocade_conversations (user_id, title, deleted_at)
    VALUES (probe_user, 'Trashed long ago', now() - interval '31 days') RETURNING id INTO lapsed;
  INSERT INTO public.ocade_conversations (user_id, title)
    VALUES (probe_user, 'Not in the trash at all') RETURNING id INTO kept;

  /*
   * The sweep runs AS THE CALLER. Called with no session it must do nothing at
   * all rather than purging the whole table, which is the failure worth
   * checking first: a SECURITY DEFINER function that ignores `auth.uid()` would
   * pass every other assertion here.
   */
  removed := public.ocade_purge_expired_conversation_trash();
  IF removed <> 0 THEN
    RAISE EXCEPTION 'the purge removed % rows with no signed-in caller', removed;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ocade_conversations WHERE id = lapsed) THEN
    RAISE EXCEPTION 'a lapsed conversation was purged by a caller with no session';
  END IF;

  /*
   * BOTH SETTINGS, because the two databases this has to pass in read different
   * ones. Supabase's `auth.uid()` parses the `request.jwt.claims` JSON; the
   * PGlite twin's shim reads the flattened `request.jwt.claim.sub`, the way
   * PostgREST also sets it. Setting only the JSON passed here and purged
   * nothing in the twin — a verification that is green on one and blind on the
   * other proves less than no verification, because it looks like proof.
   */
  PERFORM set_config('request.jwt.claim.sub', probe_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', probe_user, 'role', 'authenticated')::text, true);
  removed := public.ocade_purge_expired_conversation_trash();
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  IF removed <> 1 THEN
    RAISE EXCEPTION 'the purge removed % rows, expected exactly the lapsed one', removed;
  END IF;
  IF EXISTS (SELECT 1 FROM public.ocade_conversations WHERE id = lapsed) THEN
    RAISE EXCEPTION 'a conversation past the undo period survived the purge';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ocade_conversations WHERE id = fresh) THEN
    RAISE EXCEPTION 'a conversation still inside the undo period was purged, so the undo is a lie';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ocade_conversations WHERE id = kept) THEN
    RAISE EXCEPTION 'a conversation that was never trashed was purged';
  END IF;

  DELETE FROM public.ocade_conversations WHERE user_id = probe_user;
  DELETE FROM auth.users WHERE id = probe_user;
END $$;
