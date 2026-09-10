-- Deleting a conversation should be undoable for a while.
--
-- `ocade_conversations` carried `archived` and nothing else, so the only way to
-- get a conversation out of the way permanently was a delete that took every
-- message with it and offered no way back. The dialog said so honestly — "This
-- cannot be undone" — which made it honest and still wrong: four canonical
-- documents ask for a trash. `docs/PRD.md` and `docs/TRD.md` list
-- "archive/trash/restore/permanent delete" as separate things Chat must
-- support; `docs/APP_FLOW.md` says the conversation menu offers "rename,
-- archive, share, export, trash or delete" and that "Trash supports the defined
-- undo period"; and `docs/Backend Schema.md` states outright that a
-- conversation row needs "archived/trash/deletion state".
--
-- ARCHIVE AND TRASH ARE DIFFERENT ACTS AND STAY DIFFERENT COLUMNS. Archiving
-- says "not in my way"; it is reversible for ever and nothing is ever removed.
-- Trashing says "I am done with this", and the row goes for real once the undo
-- period lapses. Collapsing them would take one of those meanings away from
-- somebody who relied on it.
--
-- THIRTY DAYS. No document names the period — `docs/APP_FLOW.md` says "the
-- defined undo period subject to retention policy" and leaves it to be defined.
-- Thirty days is long enough to cover a holiday and short enough that "deleted"
-- means something, and it is written here once so the screen that counts down
-- and the sweep that purges cannot disagree about it.

BEGIN;

ALTER TABLE public.ocade_conversations
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.ocade_conversations.deleted_at IS
  'When this conversation was moved to trash. NULL means it is not in the trash. Purged after the undo period; see ocade_conversation_trash_days().';

/*
 * The trash view, and the sweep, both read this index: every query about the
 * trash is "this account's rows where deleted_at is not null", and a partial
 * index costs nothing for the overwhelming majority of rows that are not in it.
 */
CREATE INDEX IF NOT EXISTS ocade_conversations_trash_idx
  ON public.ocade_conversations (user_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

-- The undo period, in one place. `usage-policy.ts` does the same for the usage
-- window, and for the same reason: a number the screen and the sweep both
-- depend on must not be written twice.
CREATE OR REPLACE FUNCTION public.ocade_conversation_trash_days()
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$ SELECT 30 $$;

/**
 * Remove this caller's conversations whose undo period has lapsed.
 *
 * SWEPT ON READ RATHER THAN ON A SCHEDULE, which is the pattern
 * `ocade_expire_due_approvals` already established here: a cron job is a second
 * system to deploy, monitor and explain, and the only moment the answer has to
 * be right is when somebody looks. Returns how many went, so a caller can say
 * so rather than guess.
 *
 * SCOPED TO THE CALLER by `auth.uid()`, not by an argument. A function that
 * took a user id could purge somebody else's.
 */
CREATE OR REPLACE FUNCTION public.ocade_purge_expired_conversation_trash()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  removed integer;
BEGIN
  IF actor IS NULL THEN RETURN 0; END IF;

  WITH gone AS (
    DELETE FROM public.ocade_conversations
     WHERE user_id = actor
       AND deleted_at IS NOT NULL
       AND deleted_at < now() - make_interval(days => public.ocade_conversation_trash_days())
    RETURNING 1
  )
  SELECT COUNT(*) INTO removed FROM gone;

  RETURN COALESCE(removed, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.ocade_conversation_trash_days() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_purge_expired_conversation_trash() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_conversation_trash_days() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_purge_expired_conversation_trash() TO authenticated;

COMMIT;
