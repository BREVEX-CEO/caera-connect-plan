-- Verifies 20260827180000_the_consent_table_was_built_twice.
--
-- Each check is a thing that was wrong before and must stay right after. They
-- are assertions rather than SELECTs so that running this file either passes
-- silently or fails loudly.

DO $$
DECLARE
  insert_policies int;
  bare_uid int;
  duplicate_indexes int;
BEGIN
  SELECT count(*) INTO insert_policies
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'legal_consent_receipts'
     AND cmd = 'INSERT';
  IF insert_policies <> 1 THEN
    RAISE EXCEPTION 'expected exactly one INSERT policy, found %', insert_policies;
  END IF;

  -- Bare auth.uid(): present, but not as a scalar subquery.
  SELECT count(*) INTO bare_uid
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'legal_consent_receipts'
     AND (coalesce(qual, '') ~ 'auth\.uid\(\)' OR coalesce(with_check, '') ~ 'auth\.uid\(\)')
     AND NOT (coalesce(qual, '') ~ 'SELECT auth\.uid\(\)'
              OR coalesce(with_check, '') ~ 'SELECT auth\.uid\(\)');
  IF bare_uid <> 0 THEN
    RAISE EXCEPTION 'still % policies re-evaluating auth.uid() per row', bare_uid;
  END IF;

  SELECT count(*) INTO duplicate_indexes
    FROM pg_indexes
   WHERE schemaname = 'public'
     AND tablename = 'legal_consent_receipts'
     AND indexdef LIKE '%(user_id, accepted_at DESC)%';
  IF duplicate_indexes <> 1 THEN
    RAISE EXCEPTION 'expected one (user_id, accepted_at) index, found %', duplicate_indexes;
  END IF;

  -- The point of the table still works: a reader can still reach their own row.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'legal_consent_receipts'
       AND cmd = 'SELECT'
       AND 'authenticated' = ANY (string_to_array(trim(both '{}' from roles::text), ','))
  ) THEN
    RAISE EXCEPTION 'signed-in readers lost their SELECT policy';
  END IF;
END $$;
