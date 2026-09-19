-- Prove the atomic truncation exists, runs as its caller, and is reachable by a
-- signed-in browser but not by a stranger.
DO $$
DECLARE
  _oid OID;
  _secdef BOOLEAN;
BEGIN
  SELECT p.oid, p.prosecdef INTO _oid, _secdef
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'ocade_delete_messages_from';
  IF _oid IS NULL THEN RAISE EXCEPTION 'ocade_delete_messages_from is missing'; END IF;
  IF _secdef THEN
    RAISE EXCEPTION 'ocade_delete_messages_from must run as its caller so RLS applies';
  END IF;
  IF NOT has_function_privilege('authenticated', _oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'a signed-in browser cannot truncate its own transcript';
  END IF;
  IF has_function_privilege('anon', _oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'an anonymous visitor can call ocade_delete_messages_from';
  END IF;
END $$;
