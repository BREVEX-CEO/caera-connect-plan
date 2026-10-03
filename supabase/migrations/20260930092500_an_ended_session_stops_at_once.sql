-- "Sign out everywhere", a staff emergency sign-out and an operator ending a
-- customer's sessions all delete the session. The access token already issued
-- for it stayed valid at the database until it expired (up to an hour), so a
-- copied token kept working straight against the API after its owner had been
-- told it was signed out.
--
-- The check PostgREST already runs before every request now also refuses a
-- token whose session is gone, and Storage gets the same rule as a restrictive
-- policy. HTTP 401, so the browser treats it as what it is: signed out.
BEGIN;

-- Is the session behind this token still there? A token that names no session
-- (none issued by Supabase Auth) has nothing to revoke. Elevated only to read
-- auth.sessions, and only about the caller.
CREATE OR REPLACE FUNCTION private.ocade_caller_session_live()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT COALESCE(auth.jwt() ->> 'session_id', '') = ''
      OR EXISTS (SELECT 1 FROM auth.sessions AS s
                  WHERE s.id = (auth.jwt() ->> 'session_id')::uuid AND s.user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION private.ocade_caller_session_live() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.ocade_caller_session_live() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ocade_enforce_second_factor()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
BEGIN
  -- Nested, not AND: the elevated checks must never even be planned for anonymous requests.
  IF current_user = 'authenticated' THEN
    IF NOT private.ocade_caller_session_live() THEN
      RAISE EXCEPTION 'This session has been signed out.'
        USING ERRCODE = 'PT401', HINT = 'session_ended';
    END IF;
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
    CREATE POLICY "An ended session reads and writes nothing" ON storage.objects
      AS RESTRICTIVE FOR ALL TO authenticated
      USING ((SELECT private.ocade_caller_session_live()))
      WITH CHECK ((SELECT private.ocade_caller_session_live()));
  END IF;
END
$$;
NOTIFY pgrst, 'reload schema';

COMMIT;
