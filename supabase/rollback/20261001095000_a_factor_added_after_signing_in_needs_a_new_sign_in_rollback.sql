-- Undo: recency counts any factor's proof again (20260904150000's function).
BEGIN;
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
DROP FUNCTION IF EXISTS public.ocade_factor_added_since_sign_in(boolean);
COMMIT;
