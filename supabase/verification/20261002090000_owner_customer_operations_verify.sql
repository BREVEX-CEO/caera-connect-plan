-- Owner Console customer operations: present, guarded, and the record cannot be changed.
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.ocade_staff_adjust_usage(uuid,text,text,bigint,text)',
                           'public.ocade_staff_suspend_account(uuid,boolean,text)',
                           'public.ocade_staff_begin_account_deletion(uuid,text,text)'] LOOP
    IF pg_get_functiondef(f::regprocedure) !~ 'ocade_staff_require'
       OR pg_get_functiondef(f::regprocedure) !~ 'ocade_staff_may_act_on' THEN
      RAISE EXCEPTION '% is not guarded by staff authority and reach', f;
    END IF;
    IF has_function_privilege('anon', f, 'EXECUTE') THEN
      RAISE EXCEPTION 'anon reaches %', f;
    END IF;
    IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = f::regprocedure)
       OR NOT COALESCE((SELECT proconfig FROM pg_proc WHERE oid = f::regprocedure) @> ARRAY['search_path=""'], false) THEN
      RAISE EXCEPTION '% is not a definer with an empty search path', f;
    END IF;
  END LOOP;
  IF NOT ('accounts.delete' = ANY (private.ocade_known_permissions()))
     OR 'accounts.delete' = ANY (private.ocade_role_permissions('admin'))
     OR NOT ('usage.manage' = ANY (private.ocade_role_permissions('billing'))) THEN
    RAISE EXCEPTION 'the new permissions are not where they belong';
  END IF;
  IF has_table_privilege('service_role', 'public.ocade_usage_adjustments', 'UPDATE')
     OR has_table_privilege('service_role', 'public.ocade_usage_adjustments', 'DELETE')
     OR has_table_privilege('authenticated', 'public.ocade_usage_adjustments', 'SELECT') THEN
    RAISE EXCEPTION 'the usage adjustment record can be changed or read directly';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ocade_usage_adjustments'::regclass) THEN
    RAISE EXCEPTION 'the usage adjustment record has no row security';
  END IF;
END
$$;
