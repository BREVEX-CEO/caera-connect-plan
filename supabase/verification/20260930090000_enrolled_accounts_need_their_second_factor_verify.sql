-- Prove the second-factor check exists, is bound to its caller, and is wired before every request.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'ocade_session_meets_second_factor' AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'ocade_session_meets_second_factor is missing or not elevated';
  END IF;
  IF has_function_privilege('anon', 'public.ocade_session_meets_second_factor()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anonymous visitors can call the elevated second-factor check';
  END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid = 'public.ocade_enforce_second_factor()'::regprocedure) THEN
    RAISE EXCEPTION 'the pre-request entry point must not be elevated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') AND NOT EXISTS (
    SELECT 1 FROM pg_db_role_setting s JOIN pg_roles r ON r.oid = s.setrole
     WHERE r.rolname = 'authenticator'
       AND array_to_string(s.setconfig, ',') LIKE '%pgrst.db_pre_request=public.ocade_enforce_second_factor%'
  ) THEN
    RAISE EXCEPTION 'PostgREST does not run the second-factor check before requests';
  END IF;
END
$$;
