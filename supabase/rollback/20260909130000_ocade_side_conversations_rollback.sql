-- Reverses 20260909130000_ocade_side_conversations.sql.
--
-- DELETES SIDE THREADS. Dropping the column drops the only thing that
-- distinguishes a side message from an ordinary turn, so the rows are removed
-- first rather than left to appear inline in every transcript that has one.

BEGIN;

DELETE FROM public.ocade_messages WHERE anchor_message_id IS NOT NULL;
DROP INDEX IF EXISTS public.ocade_messages_conversation_thread_idx;
DROP INDEX IF EXISTS public.ocade_messages_anchor_idx;
ALTER TABLE public.ocade_messages DROP COLUMN IF EXISTS anchor_message_id;

COMMIT;
