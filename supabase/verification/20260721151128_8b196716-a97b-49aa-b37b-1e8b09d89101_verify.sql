-- Verification for 20260721151128 (FICIA HR schema).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ficia_locations','ficia_departments','ficia_teams','ficia_employments',
    'ficia_custom_roles','ficia_role_grants','ficia_approval_policies','ficia_approval_requests',
    'ficia_approval_decisions'] LOOP
    IF to_regclass('public.'||t) IS NULL THEN RAISE EXCEPTION 'missing table %', t; END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='public' AND c.relname=t) THEN RAISE EXCEPTION 'RLS off on %', t; END IF;
  END LOOP;
  PERFORM 1 FROM pg_type WHERE typname='approval_status'; IF NOT FOUND THEN RAISE EXCEPTION 'missing enum approval_status'; END IF;
  PERFORM 1 FROM pg_proc WHERE proname='ficia_has_permission'; IF NOT FOUND THEN RAISE EXCEPTION 'missing function ficia_has_permission'; END IF;
  RAISE NOTICE 'verify 20260721151128 OK';
END $$;
