-- Task-bound turns and checked outcomes: the binding function, the three guards and the columns exist.
DO $$
BEGIN
  IF to_regprocedure('public.ocade_bind_permit_to_task(uuid, text, uuid)') IS NULL THEN
    RAISE EXCEPTION 'ocade_bind_permit_to_task is missing';
  END IF;
  IF (SELECT count(*) FROM pg_trigger
       WHERE tgname IN ('jarvis_task_outcome_is_fixed', 'jarvis_tasks_completion_matches_its_check',
                        'jarvis_no_action_after_completion')) <> 3 THEN
    RAISE EXCEPTION 'a task completion guard is missing';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_name = 'jarvis_tasks' AND column_name IN ('outcome', 'verified_actions')) <> 2 THEN
    RAISE EXCEPTION 'jarvis_tasks.outcome or verified_actions is missing';
  END IF;
END
$$;
