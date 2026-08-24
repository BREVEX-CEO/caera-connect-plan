-- OCADE-IRREVERSIBLE: The policy rewrites and generated covering indexes are behavior-preserving,
-- but their prior catalogue expressions and index set are not reconstructible
-- without the pre-migration snapshot. Refuse a guessed destructive rollback.
DO $$
BEGIN
  RAISE NOTICE 'Performance hardening retained; restore the approved pre-migration backup for full reversal.';
END;
$$;
