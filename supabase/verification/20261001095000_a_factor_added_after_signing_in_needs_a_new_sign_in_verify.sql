-- Recent proof ignores a factor added after the session began.
DO $$
BEGIN
  IF pg_get_functiondef('public.ocade_require_recent_strong_auth(text)'::regprocedure)
       !~ 'ocade_factor_added_since_sign_in' THEN
    RAISE EXCEPTION 'recency still trusts a factor added during the session';
  END IF;
  IF has_function_privilege('anon', 'public.ocade_factor_added_since_sign_in(boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can ask about factors';
  END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid = 'public.ocade_factor_added_since_sign_in(boolean)'::regprocedure) IS NOT TRUE THEN
    RAISE EXCEPTION 'the factor check cannot read auth';
  END IF;
END
$$;
