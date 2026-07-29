-- Verification for 20260721134240 (admin-write role policies + gated flag read).
DO $$
BEGIN
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND policyname='user_roles_admin_insert';
  IF NOT FOUND THEN RAISE EXCEPTION 'missing policy user_roles_admin_insert'; END IF;
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='feature_flags' AND policyname='feature_flags_enabled_read';
  IF NOT FOUND THEN RAISE EXCEPTION 'missing policy feature_flags_enabled_read'; END IF;
  RAISE NOTICE 'verify 20260721134240 OK';
END $$;
