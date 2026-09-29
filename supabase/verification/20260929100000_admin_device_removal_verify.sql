-- Prove operator device removal exists, is not callable signed out, and its record is not browser-readable.
DO $$
BEGIN
  IF to_regprocedure('public.ocade_admin_remove_device(uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'ocade_admin_remove_device is missing';
  END IF;
  IF has_function_privilege('anon', 'public.ocade_admin_remove_device(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anyone signed out can remove a device';
  END IF;
  IF has_table_privilege('authenticated', 'public.ocade_admin_actions', 'SELECT')
     OR has_table_privilege('authenticated', 'public.ocade_admin_actions', 'INSERT')
     OR has_table_privilege('anon', 'public.ocade_admin_actions', 'SELECT') THEN
    RAISE EXCEPTION 'a browser can read or write the operator record directly';
  END IF;
END
$$;
