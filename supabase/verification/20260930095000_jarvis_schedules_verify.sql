-- JARVIS schedules exist, are private to their owner, and only the server writes them.
DO $$
BEGIN
  IF to_regclass('public.jarvis_schedules') IS NULL THEN
    RAISE EXCEPTION 'jarvis_schedules is missing';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.jarvis_schedules'::regclass) THEN
    RAISE EXCEPTION 'jarvis_schedules must have row-level security';
  END IF;
  IF has_table_privilege('anon', 'public.jarvis_schedules', 'SELECT') THEN
    RAISE EXCEPTION 'nobody signed out may read schedules';
  END IF;
  IF has_table_privilege('authenticated', 'public.jarvis_schedules', 'INSERT')
     OR has_table_privilege('authenticated', 'public.jarvis_schedules', 'UPDATE') THEN
    RAISE EXCEPTION 'schedules are created and advanced only by the server';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.jarvis_schedules', 'DELETE') THEN
    RAISE EXCEPTION 'a person must be able to remove their own schedule';
  END IF;
  IF to_regclass('public.jarvis_schedules_due_idx') IS NULL THEN
    RAISE EXCEPTION 'the due-schedule index is missing';
  END IF;
END
$$;
