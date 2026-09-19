-- Prove the client can read its devices and can write neither them nor their
-- grants, and that registration serialises on the scope the cap counts.
DO $$
DECLARE
  _lock TEXT;
BEGIN
  IF NOT has_table_privilege('authenticated', 'public.devices', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated can no longer read its own devices';
  END IF;
  IF has_table_privilege('authenticated', 'public.devices', 'INSERT')
     OR has_table_privilege('authenticated', 'public.devices', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.devices', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated can still write public.devices directly';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.browser_grants', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated can no longer read its own browser grants';
  END IF;
  IF has_table_privilege('authenticated', 'public.browser_grants', 'INSERT')
     OR has_table_privilege('authenticated', 'public.browser_grants', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.browser_grants', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated can still write public.browser_grants directly';
  END IF;

  PERFORM 1 FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'devices'
     AND policyname = 'devices_self_read' AND cmd = 'SELECT';
  IF NOT FOUND THEN RAISE EXCEPTION 'devices_self_read is missing or not SELECT-only'; END IF;

  PERFORM 1 FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'browser_grants'
     AND policyname = 'own grants' AND cmd = 'SELECT';
  IF NOT FOUND THEN RAISE EXCEPTION 'own grants is missing or not SELECT-only'; END IF;

  PERFORM 1 FROM pg_proc
   WHERE proname = 'revoke_device_for_current_user' AND prosecdef;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'removal cannot write the tables the caller no longer may';
  END IF;

  SELECT prosrc INTO _lock FROM pg_proc
   WHERE proname = 'register_browser_device_for_current_user';
  IF _lock IS NULL THEN RAISE EXCEPTION 'registration function is missing'; END IF;
  IF _lock NOT LIKE '%_kind::text%' OR _lock LIKE '%|| _browser_install_id, 0%' THEN
    RAISE EXCEPTION 'registration is not serialised per account and device kind';
  END IF;
END $$;
