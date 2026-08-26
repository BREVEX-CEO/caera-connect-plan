-- Assert the support ticket category constraint accepts the expanded routing
-- set used by the public contact model.

DO $$
DECLARE
  definition TEXT;
BEGIN
  SELECT pg_catalog.pg_get_constraintdef(c.oid)
  INTO definition
  FROM pg_catalog.pg_constraint AS c
  JOIN pg_catalog.pg_class AS t ON t.oid = c.conrelid
  JOIN pg_catalog.pg_namespace AS n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'ocade_support_tickets'
    AND c.conname = 'ocade_support_tickets_category_check';

  IF definition IS NULL THEN
    RAISE EXCEPTION 'ocade_support_tickets_category_check is missing.';
  END IF;

  IF position('''legal''' IN definition) = 0
    OR position('''investor''' IN definition) = 0
    OR position('''partnership''' IN definition) = 0
  THEN
    RAISE EXCEPTION 'Support ticket categories were not expanded.';
  END IF;
END;
$$;
