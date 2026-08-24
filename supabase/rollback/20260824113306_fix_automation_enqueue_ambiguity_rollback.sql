-- OCADE-IRREVERSIBLE: The prior function is known to fail at runtime because output parameter id
-- collides with unqualified table columns. Never reintroduce that defect; use
-- a new forward migration if enqueue behavior must change.
DO $$
BEGIN
  RAISE NOTICE 'Automation ambiguity fix retained; use a reviewed forward migration for future behavior changes.';
END;
$$;
