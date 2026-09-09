-- Verifies 20260909190000_ocade_tasks_and_comments.sql.

DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['ocade_tasks', 'ocade_task_comments'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = target
    ) THEN
      RAISE EXCEPTION '% is missing', target;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_class
      WHERE relname = target AND relnamespace = 'public'::regnamespace AND relrowsecurity
    ) THEN
      RAISE EXCEPTION '% does not have row-level security enabled', target;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = target) THEN
      RAISE EXCEPTION '% has row-level security and no policy, so it is unreadable', target;
    END IF;
  END LOOP;

  -- A comment must go when its task goes; an orphaned comment is a note about
  -- work nobody can find.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ocade_task_comments'::regclass
      AND contype = 'f'
      AND confrelid = 'public.ocade_tasks'::regclass
      AND confdeltype = 'c'
  ) THEN
    RAISE EXCEPTION 'ocade_task_comments does not cascade from ocade_tasks';
  END IF;

  -- And a reply must go when the comment it answers goes.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ocade_task_comments'::regclass
      AND contype = 'f'
      AND confrelid = 'public.ocade_task_comments'::regclass
      AND confdeltype = 'c'
  ) THEN
    RAISE EXCEPTION 'a task comment reply does not cascade from its parent';
  END IF;
END $$;
