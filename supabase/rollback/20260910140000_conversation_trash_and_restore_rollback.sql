-- Reverses 20260910140000_conversation_trash_and_restore.sql.
--
-- Anything sitting in the trash is RESTORED rather than dropped. Rolling back a
-- feature is not a reason to destroy the conversations somebody was still
-- inside the undo period for, and a `DROP COLUMN` alone would silently do
-- exactly that by making them indistinguishable from live rows — which is the
-- safer of the two directions, so it is the one chosen deliberately here.

BEGIN;

UPDATE public.ocade_conversations SET deleted_at = NULL WHERE deleted_at IS NOT NULL;

DROP FUNCTION IF EXISTS public.ocade_purge_expired_conversation_trash();
DROP FUNCTION IF EXISTS public.ocade_conversation_trash_days();
DROP INDEX IF EXISTS public.ocade_conversations_trash_idx;
ALTER TABLE public.ocade_conversations DROP COLUMN IF EXISTS deleted_at;

COMMIT;
