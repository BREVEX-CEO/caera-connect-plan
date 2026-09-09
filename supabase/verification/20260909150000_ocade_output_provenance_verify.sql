-- Verifies 20260909150000_ocade_output_provenance.sql.

DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['produced_by', 'verified', 'evidence', 'context'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'ocade_outputs' AND c.column_name = target
    ) THEN
      RAISE EXCEPTION 'ocade_outputs.% is missing', target;
    END IF;
  END LOOP;

  -- The one that has to be right: an output whose verification state is unknown
  -- must read as unverified. A nullable column, or a true default, would make an
  -- unchecked result indistinguishable from a checked one.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'ocade_outputs'
      AND c.column_name = 'verified' AND c.is_nullable <> 'NO'
  ) THEN
    RAISE EXCEPTION 'ocade_outputs.verified is nullable, so "unknown" and "checked" are the same row';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'ocade_outputs'
      AND c.column_name = 'verified' AND c.column_default = 'false'
  ) THEN
    RAISE EXCEPTION 'ocade_outputs.verified does not default to false';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'ocade_outputs_user_verified_idx'
  ) THEN
    RAISE EXCEPTION 'ocade_outputs_user_verified_idx is missing, so the Artifacts list scans every row';
  END IF;
END $$;
