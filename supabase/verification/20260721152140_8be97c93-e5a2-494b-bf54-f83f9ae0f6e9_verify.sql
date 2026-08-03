-- Verification for 20260721152140 (messenger storage policies present).
DO $$
BEGIN
  PERFORM 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='messenger_read';
  IF NOT FOUND THEN RAISE EXCEPTION 'missing storage policy messenger_read'; END IF;
  PERFORM 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='messenger_insert';
  IF NOT FOUND THEN RAISE EXCEPTION 'missing storage policy messenger_insert'; END IF;
  PERFORM 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='messenger_delete_own';
  IF NOT FOUND THEN RAISE EXCEPTION 'missing storage policy messenger_delete_own'; END IF;
  RAISE NOTICE 'verify 20260721152140 OK';
END $$;
