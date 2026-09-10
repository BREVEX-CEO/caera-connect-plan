-- Verifies 20260910100000_conversation_storage_is_the_account.sql.

DO $$
DECLARE
  body text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'ocade_conversations'
       AND column_name = 'privacy_mode'
  ) THEN
    RAISE EXCEPTION 'ocade_conversations still carries privacy_mode, a storage mode the product no longer has';
  END IF;

  SELECT prosrc INTO body
    FROM pg_proc
   WHERE pronamespace = 'public'::regnamespace
     AND proname = 'ocade_share_conversation';

  IF body IS NULL THEN
    RAISE EXCEPTION 'ocade_share_conversation is missing, so a conversation cannot be shared at all';
  END IF;

  IF body LIKE '%privacy_mode%' THEN
    RAISE EXCEPTION 'sharing still reads privacy_mode, which no longer exists, so every share would fail';
  END IF;

  IF body NOT LIKE '%conversation_empty%' THEN
    RAISE EXCEPTION 'sharing no longer refuses an empty conversation, so a share would publish a title and nothing else';
  END IF;

  IF body NOT LIKE '%not_found_or_forbidden%' THEN
    RAISE EXCEPTION 'sharing no longer refuses a conversation the caller does not own';
  END IF;
END $$;
