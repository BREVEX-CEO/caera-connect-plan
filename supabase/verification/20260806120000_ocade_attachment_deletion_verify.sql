-- Self-checking verification for complete attachment deletion.
--
-- This does not merely assert that objects exist. It performs a real cascade
-- delete against real rows and proves a tombstone survives it, because the
-- entire point of the migration is behaviour under cascade — and a cascade is
-- exactly the path where ordinary application cleanup never runs.

DO $$
DECLARE
  test_user   uuid := '00000000-0000-4000-8000-00000000dead';
  test_thread uuid;
  test_msg    uuid;
  tombstones  integer;
  survived    integer;
BEGIN
  ----------------------------------------------------------------------------
  -- Structure
  ----------------------------------------------------------------------------
  IF to_regclass('public.storage_tombstones') IS NULL THEN
    RAISE EXCEPTION 'storage_tombstones is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgname = 'msg_attachments_tombstone_storage' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'missing tombstone trigger on msg_attachments';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'storage_tombstones' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'storage_tombstones does not have row level security enabled';
  END IF;

  -- A queue of "delete these bytes" must not be writable by tenants: naming
  -- another tenant's path would make the sweeper delete their file.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'storage_tombstones'
      AND cmd <> 'SELECT'
  ) THEN
    RAISE EXCEPTION 'storage_tombstones exposes a non-SELECT policy to tenants';
  END IF;

  ----------------------------------------------------------------------------
  -- Behaviour: the cascade must not orphan
  ----------------------------------------------------------------------------
  INSERT INTO auth.users (id, email)
  VALUES (test_user, 'verify-attachment-deletion@example.invalid')
  ON CONFLICT (id) DO NOTHING;

  -- kind = 'private' deliberately: the table's CHECK requires a tenant_id for
  -- every other kind, and this fixture must not invent a tenant.
  INSERT INTO public.msg_threads (kind, created_by, name)
  VALUES ('private', test_user, 'verification thread')
  RETURNING id INTO test_thread;

  INSERT INTO public.msg_messages (thread_id, author_id, body)
  VALUES (test_thread, test_user, 'verification message')
  RETURNING id INTO test_msg;

  INSERT INTO public.msg_attachments
    (message_id, thread_id, uploaded_by, file_name, mime, size_bytes, storage_path)
  VALUES
    (test_msg, test_thread, test_user, 'verify.txt', 'text/plain', 4,
     'verify/' || test_msg::text || '/verify.txt');

  -- Delete the MESSAGE, not the attachment. This is the cascade path that
  -- previously discarded storage_path with nothing recording it.
  DELETE FROM public.msg_messages WHERE id = test_msg;

  SELECT count(*) INTO survived FROM public.msg_attachments WHERE message_id = test_msg;
  IF survived <> 0 THEN
    RAISE EXCEPTION 'attachment row survived its message; cascade is not configured';
  END IF;

  SELECT count(*) INTO tombstones
  FROM public.storage_tombstones
  WHERE storage_path = 'verify/' || test_msg::text || '/verify.txt'
    AND purged_at IS NULL
    AND owner_id = test_user;

  IF tombstones <> 1 THEN
    RAISE EXCEPTION
      'cascade delete orphaned a storage object: expected 1 pending tombstone, found %',
      tombstones;
  END IF;

  ----------------------------------------------------------------------------
  -- Clean up the fixture. The tombstone itself is removed LAST and explicitly,
  -- because leaving it would queue a sweeper delete for a path that never
  -- existed in the bucket.
  ----------------------------------------------------------------------------
  DELETE FROM public.storage_tombstones
   WHERE storage_path = 'verify/' || test_msg::text || '/verify.txt';
  DELETE FROM public.msg_threads WHERE id = test_thread;
  DELETE FROM auth.users WHERE id = test_user;

  RAISE NOTICE 'attachment deletion verified: cascade preserved the storage path';
END $$;
