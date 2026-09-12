-- Proves the Library table isolates accounts, chases its bytes, and that the
-- Artifacts table it replaces is gone.
DO $$
DECLARE
  mine UUID := '00000000-0000-4000-8000-00000000b001';
  theirs UUID := '00000000-0000-4000-8000-00000000b002';
  item UUID;
  visible INT;
  tombstoned INT;
BEGIN
  IF to_regclass('public.ocade_library_items') IS NULL THEN
    RAISE EXCEPTION 'the library table is missing';
  END IF;
  IF to_regclass('public.ocade_outputs') IS NOT NULL THEN
    RAISE EXCEPTION 'the retired Artifacts table is still present';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'library' AND public = false) THEN
    RAISE EXCEPTION 'the library bucket is missing or is not private';
  END IF;

  -- The catalogue, not the behaviour: a policy or a trigger that is dropped
  -- later leaves the behavioural half below passing on a superuser connection
  -- long after it stopped protecting anybody.
  IF (SELECT count(*) FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'ocade_library_items') <> 4 THEN
    RAISE EXCEPTION 'the library table does not carry its four owner policies';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'ocade_library_items_tombstone_storage' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'deleting a library row would orphan its object: the tombstone trigger is gone';
  END IF;
  IF has_function_privilege('authenticated', 'public.tombstone_deleted_library_item()', 'EXECUTE') THEN
    RAISE EXCEPTION 'the tombstone trigger function is callable by a signed-in user';
  END IF;

  INSERT INTO auth.users (id, email) VALUES
    (mine, 'library-owner@verification.test'),
    (theirs, 'library-other@verification.test')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.ocade_library_items (user_id, kind, source, name, mime, size_bytes, storage_path)
  VALUES (mine, 'file', 'upload', 'notes.txt', 'text/plain', 12, mine || '/one')
  RETURNING id INTO item;

  INSERT INTO public.ocade_library_items (user_id, kind, source, name, mime, size_bytes, storage_path)
  VALUES (theirs, 'image', 'generated', 'chart.png', 'image/png', 40, theirs || '/two');

  -- AS THE OWNER: one row, and it is theirs.
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', mine, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO visible FROM public.ocade_library_items;
  IF visible <> 1 THEN
    RAISE EXCEPTION 'an account can see % library rows instead of its own one', visible;
  END IF;

  -- AND CANNOT REACH THE OTHER ACCOUNT'S, by reading, updating or deleting it.
  IF EXISTS (SELECT 1 FROM public.ocade_library_items WHERE user_id = theirs) THEN
    RAISE EXCEPTION 'one account can read another account library';
  END IF;
  UPDATE public.ocade_library_items SET name = 'taken.png' WHERE user_id = theirs;
  IF FOUND THEN
    RAISE EXCEPTION 'one account can rename another account library item';
  END IF;
  DELETE FROM public.ocade_library_items WHERE user_id = theirs;
  IF FOUND THEN
    RAISE EXCEPTION 'one account can delete another account library item';
  END IF;

  -- DELETING MINE LEAVES A TOMBSTONE, so the bytes are chased rather than
  -- orphaned in the bucket.
  DELETE FROM public.ocade_library_items WHERE id = item;
  RESET ROLE;
  SELECT count(*) INTO tombstoned FROM public.storage_tombstones
   WHERE bucket = 'library' AND storage_path = mine || '/one';
  IF tombstoned <> 1 THEN
    RAISE EXCEPTION 'deleting a library item left its object untracked';
  END IF;

  RAISE NOTICE 'library isolation, deletion and tombstoning verified';
  RAISE EXCEPTION 'rollback verification fixture';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'rollback verification fixture' THEN RAISE; END IF;
END $$;
