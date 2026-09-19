-- Prove the registration function exists, is SECURITY DEFINER, has a pinned
-- search path, and is callable by a signed-in customer but not by anon.
DO $$
DECLARE
  _oid OID;
BEGIN
  SELECT p.oid INTO _oid
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'register_browser_device_for_current_user';

  IF _oid IS NULL THEN
    RAISE EXCEPTION 'public.register_browser_device_for_current_user() is missing';
  END IF;

  IF NOT (SELECT p.prosecdef FROM pg_proc AS p WHERE p.oid = _oid) THEN
    RAISE EXCEPTION 'register_browser_device_for_current_user() is not SECURITY DEFINER';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc AS p
     WHERE p.oid = _oid
       AND 'search_path=public' = ANY(COALESCE(p.proconfig, ARRAY[]::text[]))
  ) THEN
    RAISE EXCEPTION 'register_browser_device_for_current_user() does not pin search_path';
  END IF;

  IF NOT has_function_privilege('authenticated', _oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated cannot execute register_browser_device_for_current_user()';
  END IF;

  IF has_function_privilege('anon', _oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute register_browser_device_for_current_user()';
  END IF;

  -- Both writes must be in the one body: a device insert with no grant insert
  -- beside it is the orphan-slot failure this migration exists to remove.
  IF (SELECT count(*) FROM regexp_matches(
        (SELECT p.prosrc FROM pg_proc AS p WHERE p.oid = _oid),
        'INSERT INTO public\.(devices|browser_grants)', 'g')) <> 2 THEN
    RAISE EXCEPTION 'register_browser_device_for_current_user() does not write both rows';
  END IF;
END;
$$;
