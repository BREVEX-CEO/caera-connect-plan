-- The per-request check refuses an ended session, stays unelevated, and the
-- liveness function answers only signed-in callers.
DO $$
BEGIN
  IF (SELECT prosecdef FROM pg_proc WHERE oid = 'public.ocade_enforce_second_factor()'::regprocedure) THEN
    RAISE EXCEPTION 'the pre-request entry point must not be elevated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE oid = 'public.ocade_enforce_second_factor()'::regprocedure
       AND prosrc LIKE '%ocade_caller_session_live%'
  ) THEN
    RAISE EXCEPTION 'the pre-request check does not refuse ended sessions';
  END IF;
  IF has_function_privilege('anon', 'private.ocade_caller_session_live()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anonymous visitors can call the elevated session check';
  END IF;
  IF to_regclass('storage.objects') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
       AND policyname = 'An ended session reads and writes nothing'
  ) THEN
    RAISE EXCEPTION 'Storage does not refuse ended sessions';
  END IF;
END
$$;
