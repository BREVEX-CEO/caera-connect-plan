-- Both guards exist on their tables.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'jarvis_tasks_completion_is_the_servers') THEN
    RAISE EXCEPTION 'jarvis_tasks_completion_is_the_servers is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'jarvis_activity_stopped_while_running') THEN
    RAISE EXCEPTION 'jarvis_activity_stopped_while_running is missing';
  END IF;
END
$$;
