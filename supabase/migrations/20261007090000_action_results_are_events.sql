-- ACTION RESULTS ARE EVENTS.
--
-- The planner learned that a device had finished a step by asking every 400 ms.
-- With jarvis_activity in the Realtime publication, the row's own update wakes
-- the planner as it happens (PLAN.md section E); the planner still reads the row
-- through its server function, so Realtime only says "look now" and never
-- decides anything. Row-level security already limits each subscriber to its
-- own account's rows. Guarded on the publication existing, as the platform
-- creates it and a bare PostgreSQL rebuild does not have it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
          AND tablename = 'jarvis_activity'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jarvis_activity;
  END IF;
END
$$;
