-- Citations and feedback belong to the message, not to the browser.
--
-- Both lived in `localStorage`: citation evidence under
-- `ocade.chat-citations.v1`, and helpful/not-helpful under
-- `ocade.chat.reactions.v1:<user>:<conversation>`. `PLAN.md` Phase 2 makes
-- Supabase the persistent authority for ordinary account content, and these are
-- two of the clearest cases — a citation is the EVIDENCE for an answer, and an
-- answer whose evidence only exists on the laptop it was produced on is an
-- answer nobody can check anywhere else.
--
-- WHY COLUMNS RATHER THAN THEIR OWN TABLES. Both are one-to-one with a message
-- and are never queried without it. The browser store had to keep its own
-- conversation and message ids, which is what produced its worst failure: a
-- deleted conversation left citation records behind, so verbatim excerpts of
-- documents somebody had deleted stayed on disk, keyed to messages that no
-- longer existed. As columns they are deleted by the same cascade that deletes
-- the message, and that class of orphan cannot occur.
--
-- `citations` IS json, deliberately: a citation is a small closed record read as
-- a whole (source id, name, kind, locator, snippet, provenance, url), it is
-- never filtered on, and there are at most ten per message.

BEGIN;

ALTER TABLE public.ocade_messages
  ADD COLUMN IF NOT EXISTS citations JSONB,
  -- Only the two values the interface offers, or nothing. A free-text column
  -- here would eventually hold a third value nothing renders.
  ADD COLUMN IF NOT EXISTS reaction TEXT
    CHECK (reaction IS NULL OR reaction IN ('helpful', 'not_helpful'));

COMMENT ON COLUMN public.ocade_messages.citations IS
  'Evidence for an assistant answer: up to ten citations, each naming its source and locator. Read whole; never filtered on.';
COMMENT ON COLUMN public.ocade_messages.reaction IS
  'The reader''s own feedback on this answer: helpful, not_helpful, or nothing.';

COMMIT;
