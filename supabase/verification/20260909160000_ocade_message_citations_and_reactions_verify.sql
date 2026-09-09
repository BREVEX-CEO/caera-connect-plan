-- Verifies 20260909160000_ocade_message_citations_and_reactions.sql.

DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['citations', 'reaction'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'ocade_messages' AND c.column_name = target
    ) THEN
      RAISE EXCEPTION 'ocade_messages.% is missing', target;
    END IF;
  END LOOP;

  -- The constraint is the point: a third value would be stored and never
  -- rendered, which reads on the screen as feedback that was not recorded.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ocade_messages'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%not_helpful%'
  ) THEN
    RAISE EXCEPTION 'ocade_messages.reaction accepts values the interface cannot show';
  END IF;
END $$;
