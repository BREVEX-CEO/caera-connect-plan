-- A SECOND FACTOR ADDED AFTER SIGNING IN PROVES NOTHING UNTIL THE NEXT SIGN-IN.
--
-- Supabase Auth lets a session at aal2 enroll another authenticator, straight
-- from the browser. So a stolen token could enroll the thief's own app, answer
-- it, and carry a fresh second-factor proof: recent enough for every action
-- that asks for one (deleting the account, signing everyone out, staff
-- changes). A factor is now trusted only by sessions that began after it was
-- added; the session it was added in is told to sign in again first, which a
-- thief holding only a token cannot do.
BEGIN;

-- Was a verified factor added to this account after the caller's session began?
-- With p_unverified_too, one merely started counts as well: the console's
-- hand-over mints a NEW session, so it asks that nothing at all was enrolled
-- since the site's session began (a factor enrolled there and answered only in
-- the new session would otherwise look older than it).
CREATE OR REPLACE FUNCTION public.ocade_factor_added_since_sign_in(p_unverified_too boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM auth.sessions AS s
      JOIN auth.mfa_factors AS f ON f.user_id = s.user_id
     WHERE s.id = NULLIF(auth.jwt() ->> 'session_id', '')::uuid
       AND s.user_id = auth.uid()
       AND (p_unverified_too OR f.status = 'verified')
       AND f.created_at > s.created_at
  );
$$;
REVOKE ALL ON FUNCTION public.ocade_factor_added_since_sign_in(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_factor_added_since_sign_in(boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ocade_require_recent_strong_auth(p_action text)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  session_aal text := auth.jwt() ->> 'aal';
  enrolled boolean := public.ocade_session_has_verified_factor();
  proved_at timestamptz := public.ocade_session_last_proof_at();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in before %.', p_action
      USING ERRCODE = 'PT403', DETAIL = 'authentication_required';
  END IF;

  IF enrolled AND COALESCE(session_aal, 'aal1') <> 'aal2' THEN
    RAISE EXCEPTION
      'Confirm the code from your authenticator app before %. It only takes a moment and it stops somebody who finds this browser open from doing it instead.',
      p_action
      USING ERRCODE = 'PT403', DETAIL = 'factor_required';
  END IF;

  -- Signing in again starts a session the new factor is older than.
  IF public.ocade_factor_added_since_sign_in() THEN
    RAISE EXCEPTION
      'You added two-step verification after signing in here. Sign in again before %.',
      p_action
      USING ERRCODE = 'PT403', DETAIL = 'reauthentication_required';
  END IF;

  -- A proof in the future is not a proof. It means the clocks disagree, and
  -- accepting it would make a skewed clock a way past this check.
  IF proved_at IS NULL
     OR proved_at > now()
     OR now() - proved_at > public.ocade_recent_proof_window() THEN
    RAISE EXCEPTION
      'Confirm it is you before %. This is asked for anything that could lock somebody out of their work, however long you have been signed in.',
      p_action
      USING ERRCODE = 'PT403', DETAIL = 'reauthentication_required';
  END IF;
END;
$$;

COMMIT;
