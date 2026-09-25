-- OCADE-IRREVERSIBLE: the dropped enum types had no column, argument or caller,
-- so nothing depended on them. A retired capability that returns gets its own
-- types through a new forward migration.
BEGIN;

DO $$
BEGIN
  RAISE NOTICE 'Orphan enum types from retired products are not restored; write a forward migration instead.';
END $$;

COMMIT;
