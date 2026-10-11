-- Undo: a fresh proof covers every sensitive action for ten minutes again.
BEGIN;
DROP FUNCTION IF EXISTS public.ocade_spend_proof(text, text);
DROP TABLE IF EXISTS private.ocade_spent_proofs;
COMMIT;
