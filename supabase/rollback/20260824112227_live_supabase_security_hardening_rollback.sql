-- OCADE-IRREVERSIBLE: This security hardening is intentionally one-way. Re-exposing private RLS
-- helpers and restoring anonymous default privileges would create a known
-- vulnerability. Recover the pre-migration database from the approved backup
-- instead of silently weakening a live project.
DO $$
BEGIN
  RAISE NOTICE 'Security hardening retained; restore the approved pre-migration backup for full reversal.';
END;
$$;
