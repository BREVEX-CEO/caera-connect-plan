-- Assert that every public foreign key has a valid covering index and the
-- atomic current-user device revocation helper no longer bypasses RLS.
DO $$
DECLARE
  uncovered_foreign_keys INTEGER;
  revocation_is_invoker BOOLEAN;
BEGIN
  SELECT count(*)
  INTO uncovered_foreign_keys
  FROM pg_catalog.pg_constraint AS constraint_row
  JOIN pg_catalog.pg_class AS table_row ON table_row.oid = constraint_row.conrelid
  JOIN pg_catalog.pg_namespace AS namespace_row ON namespace_row.oid = table_row.relnamespace
  WHERE constraint_row.contype = 'f'
    AND namespace_row.nspname = 'public'
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_index AS index_row
      WHERE index_row.indrelid = constraint_row.conrelid
        AND index_row.indisvalid
        AND (
          SELECT array_agg(index_key.attnum ORDER BY index_key.ordinality)
          FROM unnest(index_row.indkey::smallint[]) WITH ORDINALITY
            AS index_key(attnum, ordinality)
          WHERE index_key.ordinality <= cardinality(constraint_row.conkey)
        ) = constraint_row.conkey
    );

  SELECT NOT p.prosecdef
  INTO revocation_is_invoker
  FROM pg_catalog.pg_proc AS p
  JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'revoke_device_for_current_user';

  IF uncovered_foreign_keys <> 0 OR revocation_is_invoker IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'RLS or foreign-key performance verification failed.';
  END IF;
END;
$$;
