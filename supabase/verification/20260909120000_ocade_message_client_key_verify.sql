-- Verifies 20260909120000_ocade_message_client_key.sql.
--
-- Each block raises rather than returning a row, so a partially applied
-- migration fails the check instead of reading as a pass with a missing line.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ocade_messages' AND column_name = 'client_key'
  ) THEN
    RAISE EXCEPTION 'ocade_messages.client_key is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'ocade_messages_user_client_key_idx'
  ) THEN
    RAISE EXCEPTION 'ocade_messages_user_client_key_idx is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ocade_messages_client_key_length_check'
  ) THEN
    RAISE EXCEPTION 'ocade_messages_client_key_length_check is missing';
  END IF;
END $$;

-- The index must actually refuse a replay.
DO $$
DECLARE
  duplicate_refused boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.ocade_messages (conversation_id, user_id, role, content, client_key)
    SELECT id, user_id, 'user', 'verification probe', 'verify-client-key-probe'
    FROM public.ocade_conversations LIMIT 1;
    INSERT INTO public.ocade_messages (conversation_id, user_id, role, content, client_key)
    SELECT id, user_id, 'user', 'verification probe', 'verify-client-key-probe'
    FROM public.ocade_conversations LIMIT 1;
  EXCEPTION WHEN unique_violation THEN
    duplicate_refused := true;
  END;

  -- Nothing to clean up: the inner block rolled back its own inserts, and an
  -- accepted probe raises below, which rolls the whole check back.

  IF NOT duplicate_refused AND EXISTS (SELECT 1 FROM public.ocade_conversations) THEN
    RAISE EXCEPTION 'a replayed client_key was accepted twice';
  END IF;
END $$;
