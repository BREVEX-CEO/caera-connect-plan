-- Owner and Staff Consoles on ocade.in, unlimited use, ownership hand-over: present and guarded.
DO $$
DECLARE
  f text;
BEGIN
  IF to_regclass('public.ocade_console_sessions') IS NOT NULL
     OR to_regprocedure('private.ocade_caller_in_console()') IS NOT NULL THEN
    RAISE EXCEPTION 'the retired console origin still has its own sessions';
  END IF;
  FOREACH f IN ARRAY ARRAY['private.ocade_staff_has(text)', 'public.has_role(uuid,public.app_role)',
                           'private.ocade_is_support_admin()'] LOOP
    IF pg_get_functiondef(f::regprocedure) !~ 'ocade_factor_added_since_sign_in' THEN
      RAISE EXCEPTION '% does not refuse a factor added during the session', f;
    END IF;
  END LOOP;
  IF pg_get_functiondef('private.ocade_staff_has(text)'::regprocedure) !~ 'ocade_caller_session_live' THEN
    RAISE EXCEPTION 'staff authority does not follow an ended session';
  END IF;
  FOREACH f IN ARRAY ARRAY['public.ocade_grant_unlimited(uuid,timestamptz,text)',
                           'public.ocade_revoke_unlimited(uuid,text)'] LOOP
    IF pg_get_functiondef(f::regprocedure) !~ 'ocade_owner_require' THEN
      RAISE EXCEPTION '% is not for owners only', f;
    END IF;
    IF has_function_privilege('anon', f, 'EXECUTE') THEN
      RAISE EXCEPTION 'anon reaches %', f;
    END IF;
  END LOOP;
  IF pg_get_functiondef('private.ocade_owner_require(text)'::regprocedure) !~ 'ocade_staff_require' THEN
    RAISE EXCEPTION 'owner changes do not need a recent code';
  END IF;
  IF has_function_privilege('authenticated', 'public.ocade_account_unlimited(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'private.ocade_usage_unlimited(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'a browser can ask about any account''s unlimited use';
  END IF;
  IF pg_get_functiondef('public.ocade_consume_commercial_work(uuid,text,timestamptz,bigint,bigint)'::regprocedure)
     !~ 'ocade_usage_unlimited' THEN
    RAISE EXCEPTION 'the allowance is enforced without asking about unlimited use';
  END IF;
  IF has_table_privilege('service_role', 'public.ocade_unlimited_grants', 'INSERT')
     OR has_table_privilege('service_role', 'public.ocade_unlimited_grants', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.ocade_unlimited_grants', 'SELECT')
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ocade_unlimited_grants'::regclass) THEN
    RAISE EXCEPTION 'unlimited grants can be written or read around their functions';
  END IF;
  IF to_regprocedure('public.ocade_staff_transfer_ownership(uuid,text)') IS NOT NULL
     OR pg_get_functiondef('public.ocade_staff_transfer_ownership(uuid,text,boolean)'::regprocedure)
        !~ 'ocade_staff_require' THEN
    RAISE EXCEPTION 'ownership hand-over is not the guarded one';
  END IF;
END
$$;
