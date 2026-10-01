-- The first-setup question exists, reads auth as its owner, and is not anon's.
DO $$
BEGIN
  IF (SELECT prosecdef FROM pg_proc
       WHERE oid = 'public.ocade_two_step_set_up_in_this_sign_in()'::regprocedure) IS NOT TRUE THEN
    RAISE EXCEPTION 'the first-setup check cannot read auth';
  END IF;
  IF has_function_privilege('anon', 'public.ocade_two_step_set_up_in_this_sign_in()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can ask about factors';
  END IF;
END
$$;
