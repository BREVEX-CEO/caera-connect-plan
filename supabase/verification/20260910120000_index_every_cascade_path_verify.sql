-- Verifies 20260910120000_index_every_cascade_path.sql.
--
-- Asserts the PROPERTY rather than the twenty-two names: no foreign key in the
-- public schema may be left without an index whose leading column is its first
-- column. A future migration that adds a foreign key and forgets its index
-- fails here rather than in production, under a lock, during a delete.

DO $$
DECLARE
  uncovered text;
BEGIN
  SELECT string_agg(format('%s.%s', tbl, conname), ', ' ORDER BY tbl, conname)
    INTO uncovered
    FROM (
      SELECT c.conrelid::regclass::text AS tbl, c.conname, c.conkey
        FROM pg_constraint c
       WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
    ) AS f
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_index i
      WHERE i.indrelid = f.tbl::regclass
        AND f.conkey[1] = (i.indkey::int2[])[0]
        AND array_length(f.conkey, 1) <= i.indnkeyatts
        AND (i.indkey::int2[])[0:array_length(f.conkey, 1) - 1] @> f.conkey
   );

  IF uncovered IS NOT NULL THEN
    RAISE EXCEPTION
      'these foreign keys have no covering index, so deleting a parent row scans the whole child table under lock: %',
      uncovered;
  END IF;
END $$;
