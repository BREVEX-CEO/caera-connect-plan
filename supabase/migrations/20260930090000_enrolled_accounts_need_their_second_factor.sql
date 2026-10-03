-- An account with a verified second factor is reachable only by sessions that
-- completed it (aal2). Until now the challenge was a client redirect: a stolen
-- password alone (aal1) could read and change the account through PostgREST.
--
-- ONE AUTHORITY: PostgREST runs public.ocade_enforce_second_factor() before
-- every request (tables and RPCs alike). Storage does not pass through
-- PostgREST, so its objects get the same rule as a restrictive policy. The
-- Worker's server functions ask public.ocade_session_meets_second_factor(),
-- which the pre-request check guards, so their service-role work is covered too.
BEGIN;

-- Elevated only to read auth.mfa_factors, and only about the caller.
CREATE OR REPLACE FUNCTION public.ocade_session_meets_second_factor()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Only signed-in people are held to this; the service role and anonymous
  -- requests are governed by their own grants and policies.
  IF auth.uid() IS NULL OR COALESCE(auth.jwt() ->> 'role', '') <> 'authenticated' THEN
    RETURN true;
  END IF;
  IF auth.jwt() ->> 'aal' = 'aal2' THEN
    RETURN true;
  END IF;
  RETURN NOT EXISTS (
    SELECT 1 FROM auth.mfa_factors AS f
     WHERE f.user_id = auth.uid() AND f.status = 'verified'
  );
END;
$$;

-- The pre-request entry point runs as whoever is asking (anonymous too), so it
-- is an ordinary function: it only calls the elevated check for signed-in people.
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

REVOKE ALL ON FUNCTION public.ocade_session_meets_second_factor() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_enforce_second_factor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ocade_session_meets_second_factor() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ocade_enforce_second_factor() TO anon, authenticated, service_role;

-- Storage requests do not run the PostgREST pre-request check.
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Enrolled accounts need their second factor" ON storage.objects;
    CREATE POLICY "Enrolled accounts need their second factor" ON storage.objects
      AS RESTRICTIVE FOR ALL TO authenticated
      USING ((SELECT public.ocade_session_meets_second_factor()))
      WITH CHECK ((SELECT public.ocade_session_meets_second_factor()));
  END IF;
END
$$;

-- Before every PostgREST request. Hosted Supabase lets the project set this on
-- the authenticator role; PostgREST picks it up on the reload below.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.ocade_enforce_second_factor';
  END IF;
END
$$;
NOTIFY pgrst, 'reload config';

COMMIT;
