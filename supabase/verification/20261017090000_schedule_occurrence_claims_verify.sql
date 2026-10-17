-- Schedule occurrence claims: the claim columns and the one-task-per-occurrence index exist.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'jarvis_schedules' AND column_name = 'claimed_occurrence') THEN
    RAISE EXCEPTION 'jarvis_schedules.claimed_occurrence is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                  WHERE indexname = 'jarvis_tasks_one_per_schedule_occurrence') THEN
    RAISE EXCEPTION 'one task per schedule occurrence is not enforced';
  END IF;
END
$$;
