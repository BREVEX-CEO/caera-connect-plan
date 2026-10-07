-- Where the platform's publication exists, action results are in it; the table
-- stays readable only through its own-account policy.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
          AND tablename = 'jarvis_activity'
     ) THEN
    RAISE EXCEPTION 'action results are not published as events';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'jarvis_activity'
       AND policyname = 'jarvis_activity_own'
  ) THEN
    RAISE EXCEPTION 'action results lost their own-account policy';
  END IF;
END
$$;
