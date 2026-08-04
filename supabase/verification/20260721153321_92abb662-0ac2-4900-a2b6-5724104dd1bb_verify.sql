-- Verification for 20260721153321_92abb662-0ac2-4900-a2b6-5724104dd1bb.
--
-- This migration adds a documentation COMMENT to public.ficia_time_entries. It
-- creates no object and grants no privilege, so there is nothing security
-- relevant to assert — but "nothing to check" is still checkable: the comment
-- either landed or it did not.
--
-- Run AFTER applying the migration. Raises (non-zero exit) on any gap.
DO $verify$
DECLARE
  actual text;
BEGIN
  IF to_regclass('public.ficia_time_entries') IS NULL THEN
    RAISE EXCEPTION 'Table public.ficia_time_entries does not exist.';
  END IF;

  SELECT obj_description('public.ficia_time_entries'::regclass, 'pg_class') INTO actual;
  IF actual IS NULL OR actual = '' THEN
    RAISE EXCEPTION 'The table comment did not apply to public.ficia_time_entries.';
  END IF;

  RAISE NOTICE 'VERIFIED: public.ficia_time_entries carries its documentation comment (%).', actual;
END
$verify$;
