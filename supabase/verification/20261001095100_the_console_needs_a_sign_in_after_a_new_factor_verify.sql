-- The console binding also refuses a session newer factors were added in.
DO $$
BEGIN
  IF pg_get_functiondef('private.ocade_caller_in_console()'::regprocedure)
       !~ 'ocade_factor_added_since_sign_in' THEN
    RAISE EXCEPTION 'the console still trusts a factor added in its own session';
  END IF;
  IF has_function_privilege('anon', 'private.ocade_caller_in_console()', 'EXECUTE')
     OR (SELECT prosecdef FROM pg_proc WHERE oid = 'private.ocade_caller_in_console()'::regprocedure) IS NOT TRUE THEN
    RAISE EXCEPTION 'the console binding lost its grants or its definer';
  END IF;
END
$$;
