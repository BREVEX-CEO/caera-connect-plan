-- One proof, one action: the spend function exists, only signed-in callers reach it,
-- and the record of spent proofs is not readable through the API.
DO $$
BEGIN
  IF to_regprocedure('public.ocade_spend_proof(text, text)') IS NULL THEN
    RAISE EXCEPTION 'ocade_spend_proof is missing';
  END IF;
  IF has_function_privilege('anon', 'public.ocade_spend_proof(text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anonymous callers can spend a proof';
  END IF;
  IF has_table_privilege('authenticated', 'private.ocade_spent_proofs', 'SELECT') THEN
    RAISE EXCEPTION 'spent proofs are readable by signed-in callers';
  END IF;
END
$$;
