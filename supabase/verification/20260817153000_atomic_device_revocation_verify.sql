-- Verifies the atomic device-revocation function exists, is SECURITY DEFINER,
-- and is callable by authenticated users but not by anon.

DO $$
DECLARE
  _secdef boolean;
BEGIN
  SELECT p.prosecdef INTO _secdef
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'revoke_device_for_current_user';

  IF _secdef IS NULL THEN
    RAISE EXCEPTION 'public.revoke_device_for_current_user() is missing';
  END IF;

  IF NOT _secdef THEN
    RAISE EXCEPTION 'revoke_device_for_current_user() is not SECURITY DEFINER';
  END IF;

  IF NOT has_function_privilege(
    'authenticated', 'public.revoke_device_for_current_user(uuid)', 'execute'
  ) THEN
    RAISE EXCEPTION 'authenticated cannot execute revoke_device_for_current_user()';
  END IF;

  IF has_function_privilege(
    'anon', 'public.revoke_device_for_current_user(uuid)', 'execute'
  ) THEN
    RAISE EXCEPTION 'anon can execute revoke_device_for_current_user()';
  END IF;
END;
$$;
