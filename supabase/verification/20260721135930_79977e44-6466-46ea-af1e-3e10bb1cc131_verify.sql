-- Verification for 20260721135930 (activity_log self-clear-old policy present).
DO $$
BEGIN
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='activity_log' AND policyname='Users can clear own old activity';
  IF NOT FOUND THEN RAISE EXCEPTION 'missing policy: Users can clear own old activity'; END IF;
  RAISE NOTICE 'verify 20260721135930 OK';
END $$;
