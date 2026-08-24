-- OCADE-IRREVERSIBLE: Consolidation removes superseded policy names after preserving their ORed
-- expressions. Recreating historical policies without the catalogue snapshot
-- could widen tenant access, so only an approved restore may reverse it.
DO $$
BEGIN
  RAISE NOTICE 'Consolidated RLS policies retained; restore the approved pre-consolidation backup for full reversal.';
END;
$$;
