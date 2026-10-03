-- Back to the second-factor check alone: an ended session's token works again
-- until it expires.
BEGIN;

CREATE OR REPLACE FUNCTION public.ocade_enforce_second_factor()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
BEGIN
  -- Nested, not AND: the elevated check must never even be planned for anonymous requests.
  IF current_user = 'authenticated' THEN
    IF NOT public.ocade_session_meets_second_factor() THEN
      RAISE EXCEPTION 'This account needs its second factor for this session.'
        USING ERRCODE = '42501', HINT = 'factor_required';
    END IF;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "An ended session reads and writes nothing" ON storage.objects;
  END IF;
END
$$;
DROP FUNCTION IF EXISTS private.ocade_caller_session_live();
NOTIFY pgrst, 'reload schema';

COMMIT;
