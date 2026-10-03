-- One staff authority: the tables, the single-owner rule, the functions, and
-- the older checks now reading it.
DO $$
DECLARE
  v_name text;
BEGIN
  IF to_regclass('public.ocade_staff') IS NULL OR to_regclass('public.ocade_staff_invites') IS NULL
     OR to_regclass('public.ocade_support_cases') IS NULL THEN
    RAISE EXCEPTION 'staff tables are missing';
  END IF;
  IF to_regclass('public.ocade_staff_one_primary_owner') IS NULL THEN
    RAISE EXCEPTION 'the one-Primary-Owner index is missing';
  END IF;
  IF has_function_privilege('anon', 'public.ocade_staff_can(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anonymous callers must not ask about staff permissions';
  END IF;
  IF has_function_privilege('authenticated', 'public.ocade_bootstrap_primary_owner(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'only the service role names the first Primary Owner';
  END IF;
  IF has_table_privilege('authenticated', 'public.ocade_staff', 'SELECT') THEN
    RAISE EXCEPTION 'signed-in people must not read the staff table directly';
  END IF;
  FOREACH v_name IN ARRAY ARRAY['ocade_admin_remove_device', 'ocade_grant_entitlement',
                                'ocade_revoke_entitlement', 'ocade_set_service_control', 'has_role'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = v_name
         AND pg_get_functiondef(p.oid) ~ 'ocade_staff'
    ) THEN
      RAISE EXCEPTION '% does not read the staff authority', v_name;
    END IF;
  END LOOP;
  -- Legacy 'admin' rows may remain in user_roles until the new console is live;
  -- what matters is that nothing on the server decides anything from them.
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname IN ('public', 'private') AND p.prokind = 'f'
       AND p.proname NOT IN ('has_role', 'handle_new_user')
       AND p.prosrc ILIKE '%user_roles%'
  ) THEN
    RAISE EXCEPTION 'a function other than has_role still reads user_roles';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'private' AND p.proname = 'ocade_is_support_admin'
       AND p.prosrc ILIKE '%ocade_staff%'
  ) THEN
    RAISE EXCEPTION 'the support-admin check does not read the staff authority';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
              AND tablename = 'ocade_entitlement_grants'
              AND policyname = 'entitlement_grants_admin_read') THEN
    RAISE EXCEPTION 'every account''s grants are still readable from a browser session';
  END IF;
  -- Every operator that existed before is staff now.
  IF EXISTS (
    SELECT 1 FROM public.user_roles AS r
     WHERE r.role = 'admin'::public.app_role
       AND NOT EXISTS (SELECT 1 FROM public.ocade_staff AS s WHERE s.user_id = r.user_id)
  ) THEN
    RAISE EXCEPTION 'a legacy admin was not carried into ocade_staff';
  END IF;
END
$$;
