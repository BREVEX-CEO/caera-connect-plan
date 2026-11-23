-- UPLOAD-06: emptying the Library records the database's own time as the person's epoch, which
-- finishing a large upload compares with when that upload began. Only the person's own epoch is
-- written or readable; a signed-out caller writes nothing. Synthetic accounts only.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
INSERT INTO auth.users (id, email) VALUES
  ('c1c1c1c1-0000-4000-8000-000000000001', 'epoch-a@example.test'),
  ('c2c2c2c2-0000-4000-8000-000000000002', 'epoch-b@example.test');
INSERT INTO public.ocade_library_items (user_id, kind, source, name, mime, size_bytes, storage_path)
VALUES ('c1c1c1c1-0000-4000-8000-000000000001', 'file', 'upload', 'a.txt', 'text/plain', 1,
        'c1c1c1c1-0000-4000-8000-000000000001/a');

SET LOCAL ROLE authenticated;
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"sub": "c1c1c1c1-0000-4000-8000-000000000001", "role": "authenticated"}', true); END $$;
DO $$
DECLARE v_removed integer; v_at timestamptz;
BEGIN
  v_removed := public.ocade_delete_all_library_items();
  IF v_removed <> 1 THEN RAISE EXCEPTION 'library epoch: expected 1 removed, got %', v_removed; END IF;
  SELECT cleared_at INTO v_at FROM public.ocade_library_epochs;
  IF v_at IS DISTINCT FROM now() THEN RAISE EXCEPTION 'library epoch: not recorded at the database time'; END IF;
  BEGIN
    INSERT INTO public.ocade_library_epochs (user_id, cleared_at)
    VALUES ('c1c1c1c1-0000-4000-8000-000000000001', now() + interval '1 day');
    RAISE EXCEPTION 'library epoch: a browser wrote its own epoch';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"sub": "c2c2c2c2-0000-4000-8000-000000000002", "role": "authenticated"}', true); END $$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.ocade_library_epochs) THEN
    RAISE EXCEPTION 'library epoch: another account''s epoch is readable';
  END IF;
  PERFORM public.ocade_fence_library_uploads();
  IF (SELECT count(*) FROM public.ocade_library_epochs) <> 1 THEN
    RAISE EXCEPTION 'library epoch: the caller''s own epoch was not written';
  END IF;
END $$;

DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{}', true); END $$;
DO $$
BEGIN
  PERFORM public.ocade_fence_library_uploads();
END $$;
RESET ROLE;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.ocade_library_epochs) <> 2 THEN
    RAISE EXCEPTION 'library epoch: a signed-out call wrote an epoch';
  END IF;
END $$;
ROLLBACK;
