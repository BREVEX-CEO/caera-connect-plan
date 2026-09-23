-- OCADE-IRREVERSIBLE: this retirement dropped empty tables, empty columns and
-- uncalled functions. Nothing held data, so there is nothing to restore; if a
-- retired capability returns it comes back through a new forward migration
-- with its own design, not by resurrecting this shape.
BEGIN;

DO $$
BEGIN
  RAISE NOTICE 'Retired trash, payment and side-thread schema is not restored; write a forward migration instead.';
END $$;

COMMIT;
