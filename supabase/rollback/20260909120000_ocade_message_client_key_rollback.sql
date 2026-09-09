-- Reverses 20260909120000_ocade_message_client_key.sql.
--
-- Dropping the column discards the idempotency keys of any turn that was
-- uploaded from an offline buffer. That is safe: the keys are only consulted
-- while a flush is in flight, and a flush cannot outlive the tab that owns it.

BEGIN;

DROP INDEX IF EXISTS public.ocade_messages_user_client_key_idx;
ALTER TABLE public.ocade_messages
  DROP CONSTRAINT IF EXISTS ocade_messages_client_key_length_check;
ALTER TABLE public.ocade_messages DROP COLUMN IF EXISTS client_key;

COMMIT;
