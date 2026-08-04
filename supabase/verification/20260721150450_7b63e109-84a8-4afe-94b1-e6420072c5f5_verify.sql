-- Verification for 20260721150450 (create_company_with_owner two-arg signature exists).
DO $$
BEGIN
  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='create_company_with_owner'
      AND pg_get_function_identity_arguments(p.oid) = '_uid uuid, _payload jsonb';
  IF NOT FOUND THEN RAISE EXCEPTION 'missing create_company_with_owner(uuid, jsonb)'; END IF;
  RAISE NOTICE 'verify 20260721150450 OK';
END $$;
