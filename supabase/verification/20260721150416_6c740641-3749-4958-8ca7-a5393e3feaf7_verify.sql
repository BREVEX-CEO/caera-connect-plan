-- Verify 20260721150416: authenticated must NOT hold EXECUTE on create_company_with_owner(jsonb).
DO $$
BEGIN
  IF to_regprocedure('public.create_company_with_owner(jsonb)') IS NOT NULL
     AND has_function_privilege('authenticated', 'public.create_company_with_owner(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'create_company_with_owner(jsonb) still EXECUTE-able by authenticated — hardening lost';
  END IF;
  RAISE NOTICE 'verify 20260721150416 OK';
END $$;
