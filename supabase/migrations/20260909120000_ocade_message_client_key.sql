-- Exactly-once message sync.
--
-- PLAN.md Phase 2 makes Supabase the single persistent authority for chat and
-- allows a turn produced by on-device generation to wait in the open tab's
-- memory while the database is unreachable. That turn is uploaded when the
-- connection returns, and the upload can be attempted more than once: a
-- request that timed out may still have been applied, and a person who
-- reloads mid-flush starts the flush again.
--
-- Without a key chosen by the client there is nothing to recognise the second
-- attempt by, and the same sentence appears twice in somebody's transcript.
-- `client_key` is that key. It is nullable because every message written while
-- connected has no need of one, and NULLs are distinct in a unique index, so
-- existing rows and ordinary writes are untouched.

BEGIN;

ALTER TABLE public.ocade_messages ADD COLUMN IF NOT EXISTS client_key TEXT;

ALTER TABLE public.ocade_messages
  DROP CONSTRAINT IF EXISTS ocade_messages_client_key_length_check;
ALTER TABLE public.ocade_messages
  ADD CONSTRAINT ocade_messages_client_key_length_check
  CHECK (client_key IS NULL OR length(client_key) BETWEEN 8 AND 200);

-- Scoped to the account, not to the conversation: the key is generated on the
-- device before the message is sent, and a device that retries after a reload
-- must collide with its own earlier attempt whatever conversation it names.
CREATE UNIQUE INDEX IF NOT EXISTS ocade_messages_user_client_key_idx
  ON public.ocade_messages (user_id, client_key);

COMMIT;
