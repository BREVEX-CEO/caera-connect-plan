-- Proves the covering index exists and actually covers the foreign key.
DO $$
DECLARE
  indexed BOOLEAN;
  leads_with_admin BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'ocade_support_access_events'
       AND indexname = 'ocade_support_access_events_admin_idx'
  ) INTO indexed;

  IF NOT indexed THEN
    RAISE EXCEPTION 'ocade_support_access_events_admin_idx is missing';
  END IF;

  -- A covering index has to LEAD with the foreign key column; one that merely
  -- mentions it somewhere later does not answer the advisor's finding.
  SELECT indexdef LIKE '%(admin_id%' INTO leads_with_admin
    FROM pg_indexes
   WHERE schemaname = 'public'
     AND indexname = 'ocade_support_access_events_admin_idx';

  IF NOT leads_with_admin THEN
    RAISE EXCEPTION 'ocade_support_access_events_admin_idx does not lead with admin_id';
  END IF;

  RAISE NOTICE 'ocade_support_access_events_admin_idx covers the admin foreign key';
END $$;
