-- Reverses 20260909160000_ocade_message_citations_and_reactions.sql.
--
-- DESTRUCTIVE: dropping `citations` discards the evidence recorded for every
-- answer, and dropping `reaction` discards the reader's own feedback. Neither
-- can be reconstructed. Run this only to undo the migration on a database that
-- has not yet stored either.

BEGIN;

ALTER TABLE public.ocade_messages
  DROP COLUMN IF EXISTS reaction,
  DROP COLUMN IF EXISTS citations;

COMMIT;
