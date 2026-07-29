-- Verify 20260721144308: resume trigger fns exist and are not authenticated-executable.
DO $$
BEGIN
  IF to_regprocedure('public.enforce_resume_attestation()') IS NOT NULL
     AND has_function_privilege('authenticated', 'public.enforce_resume_attestation()', 'EXECUTE') THEN
    RAISE EXCEPTION 'enforce_resume_attestation still EXECUTE-able by authenticated — hardening lost';
  END IF;
  RAISE NOTICE 'verify 20260721144308 OK';
END $$;
