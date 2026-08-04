-- Verify 20260720120249: authenticated must NOT hold EXECUTE on has_role (hardening held).
DO $$
BEGIN
  IF to_regprocedure('public.has_role(uuid, public.app_role)') IS NOT NULL
     AND has_function_privilege('authenticated', 'public.has_role(uuid, public.app_role)', 'EXECUTE') THEN
    RAISE EXCEPTION 'has_role is still EXECUTE-able by authenticated — REVOKE hardening was lost';
  END IF;
  RAISE NOTICE 'verify 20260720120249 OK (has_role EXECUTE revoked from authenticated)';
END $$;
