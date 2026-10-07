-- Undo: the planner falls back to its timer alone.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
       AND tablename = 'jarvis_activity'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.jarvis_activity;
  END IF;
END
$$;

COMMIT;
