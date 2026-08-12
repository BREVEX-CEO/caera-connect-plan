-- Verification for 20260721153321_92abb662-0ac2-4900-a2b6-5724104dd1bb.
--
-- The migration applies a documentation COMMENT to public.ficia_time_entries
-- only where that table exists (see the migration for defect DB-01). It creates
-- no object and grants no privilege, so there is nothing security relevant to
-- assert — but "nothing to check" is still checkable.
--
-- BOTH OUTCOMES ARE CORRECT, AND THE SCRIPT HAS TO SAY WHICH ONE IT SAW.
-- On the hosted database the table is present and must carry the comment. On a
-- database rebuilt from this migration set the table never existed, because
-- FICIA is not part of the product and nothing here creates it. Demanding the
-- table unconditionally was what made a from-scratch rebuild unverifiable.
--
-- Run AFTER applying the migration. Raises (non-zero exit) on any gap.
DO $verify$
DECLARE
  actual text;
BEGIN
  IF to_regclass('public.ficia_time_entries') IS NULL THEN
    RAISE NOTICE 'VERIFIED: public.ficia_time_entries is absent, so the comment was correctly skipped.';
    RETURN;
  END IF;

  SELECT obj_description('public.ficia_time_entries'::regclass, 'pg_class') INTO actual;
  IF actual IS NULL OR actual = '' THEN
    RAISE EXCEPTION 'The table exists but the comment did not apply to public.ficia_time_entries.';
  END IF;

  RAISE NOTICE 'VERIFIED: public.ficia_time_entries carries its documentation comment (%).', actual;
END
$verify$;
