-- Verify 20260721151159: set_updated_at exists and is not PUBLIC-executable.
DO $$
BEGIN
  PERFORM 1 FROM pg_proc WHERE proname='set_updated_at'; IF NOT FOUND THEN RAISE EXCEPTION 'missing set_updated_at'; END IF;
  IF has_function_privilege('public', 'public.set_updated_at()', 'EXECUTE') THEN
    RAISE EXCEPTION 'set_updated_at still EXECUTE-able by PUBLIC — hardening lost';
  END IF;
  RAISE NOTICE 'verify 20260721151159 OK';
END $$;
