-- Verifies 20260909130000_ocade_side_conversations.sql.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ocade_messages'
      AND column_name = 'anchor_message_id'
  ) THEN
    RAISE EXCEPTION 'ocade_messages.anchor_message_id is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'ocade_messages_anchor_idx'
  ) THEN
    RAISE EXCEPTION 'ocade_messages_anchor_idx is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'ocade_messages_conversation_thread_idx'
  ) THEN
    RAISE EXCEPTION 'ocade_messages_conversation_thread_idx is missing';
  END IF;

  -- The cascade is the whole reason this is a column and not a table.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.ocade_messages'::regclass
      AND contype = 'f'
      AND confrelid = 'public.ocade_messages'::regclass
      AND confdeltype = 'c'
  ) THEN
    RAISE EXCEPTION 'anchor_message_id does not cascade on delete';
  END IF;
END $$;
