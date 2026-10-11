-- The staff rule spends proofs, and the read it no longer covers has its own check.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'private'
                  AND table_name = 'ocade_spent_proofs' AND column_name = 'changed_in') THEN
    RAISE EXCEPTION 'ocade_spent_proofs.changed_in is missing';
  END IF;
  IF to_regprocedure('private.ocade_staff_check(text, text)') IS NULL THEN
    RAISE EXCEPTION 'private.ocade_staff_check is missing';
  END IF;
  IF position('ocade_spent_proofs' IN pg_get_functiondef('private.ocade_staff_require(text, text)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'private.ocade_staff_require does not spend the proof';
  END IF;
END
$$;
