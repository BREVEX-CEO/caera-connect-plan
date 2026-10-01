-- Staff authority is bound to a console session: the record exists, no browser
-- session reads or writes it, and all three staff checks ask it.
DO $$
DECLARE
  v_fn text;
BEGIN
  IF to_regclass('public.ocade_console_sessions') IS NULL THEN
    RAISE EXCEPTION 'console sessions are not recorded';
  END IF;
  IF has_table_privilege('authenticated', 'public.ocade_console_sessions', 'SELECT')
     OR has_table_privilege('authenticated', 'public.ocade_console_sessions', 'INSERT') THEN
    RAISE EXCEPTION 'signed-in people must not read or write console sessions';
  END IF;
  FOREACH v_fn IN ARRAY ARRAY['private.ocade_staff_has(text)',
                              'public.has_role(uuid,public.app_role)',
                              'private.ocade_is_support_admin()'] LOOP
    IF pg_get_functiondef(to_regprocedure(v_fn)) !~ 'ocade_caller_in_console' THEN
      RAISE EXCEPTION '% does not ask for a console session', v_fn;
    END IF;
  END LOOP;
END
$$;
