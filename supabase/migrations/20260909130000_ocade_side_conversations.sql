-- Side conversations, in the table conversations already live in.
--
-- A side conversation is a short thread hanging off ONE message: somebody
-- reading an answer asks "what does this word mean" without that question
-- becoming part of the thread they will read back tomorrow.
--
-- They used to live in an encrypted browser vault under a `side:` key prefix,
-- which the main transcript loader had to remember to exclude. `PLAN.md`
-- Phase 2 leaves one persistent authority, and the honest place for them is
-- here: they belong to a message, they travel with the conversation, and the
-- foreign key deletes them with it rather than leaving an orphaned record of a
-- conversation somebody deleted.
--
-- A NULLABLE COLUMN RATHER THAN A SECOND TABLE. A side message is a message —
-- same columns, same row-level security, same account. A parallel table would
-- have to repeat all three and would give the product two answers to "what did
-- OCADE say", which is the duplication this phase exists to remove.

BEGIN;

ALTER TABLE public.ocade_messages
  ADD COLUMN IF NOT EXISTS anchor_message_id UUID
  REFERENCES public.ocade_messages(id) ON DELETE CASCADE;

-- Partial: the overwhelming majority of rows are ordinary turns and index
-- entries for them would be dead weight on every write.
CREATE INDEX IF NOT EXISTS ocade_messages_anchor_idx
  ON public.ocade_messages (anchor_message_id, created_at)
  WHERE anchor_message_id IS NOT NULL;

-- The main transcript reads `anchor_message_id IS NULL`, so it needs the
-- ordinary turns of one conversation in creation order without walking the
-- side threads hanging off them.
CREATE INDEX IF NOT EXISTS ocade_messages_conversation_thread_idx
  ON public.ocade_messages (conversation_id, created_at)
  WHERE anchor_message_id IS NULL;

COMMIT;
