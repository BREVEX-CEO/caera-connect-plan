-- Reverses 20260909150000_ocade_output_provenance.sql.
--
-- DESTRUCTIVE: dropping these columns discards every artifact's record of what
-- produced it and whether that step confirmed its own result. The content
-- survives; the reason to trust it does not. Run this only to undo the
-- migration on a database that has not yet stored artifacts through it.

BEGIN;

DROP INDEX IF EXISTS public.ocade_outputs_user_verified_idx;

ALTER TABLE public.ocade_outputs
  DROP COLUMN IF EXISTS context,
  DROP COLUMN IF EXISTS evidence,
  DROP COLUMN IF EXISTS verified,
  DROP COLUMN IF EXISTS produced_by;

COMMIT;
