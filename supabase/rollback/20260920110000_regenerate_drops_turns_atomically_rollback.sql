-- Remove the atomic transcript-truncation function.
--
-- Nothing else calls it, so dropping it only removes the capability; the browser
-- would have to go back to deleting turn by turn, which is the partial-failure
-- defect this replaced.
BEGIN;

DROP FUNCTION IF EXISTS public.ocade_delete_messages_from(UUID, TIMESTAMPTZ);

COMMIT;
