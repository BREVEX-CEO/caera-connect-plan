-- Verify 20260721151224: ficia helpers exist and are not anon-executable.
DO $$
BEGIN
  IF to_regprocedure('public.ficia_has_permission(uuid, uuid, text)') IS NOT NULL
     AND has_function_privilege('anon', 'public.ficia_has_permission(uuid, uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'ficia_has_permission still EXECUTE-able by anon — hardening lost';
  END IF;
  RAISE NOTICE 'verify 20260721151224 OK';
END $$;
