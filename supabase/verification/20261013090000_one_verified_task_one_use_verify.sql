-- One verified task is one use: the charge table, the completion trigger and task_id exist.
DO $$
BEGIN
  IF to_regclass('public.ocade_jarvis_task_charges') IS NULL THEN
    RAISE EXCEPTION 'ocade_jarvis_task_charges is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'jarvis_completed_task_is_one_use') THEN
    RAISE EXCEPTION 'jarvis_completed_task_is_one_use is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'ocade_generation_permits' AND column_name = 'task_id') THEN
    RAISE EXCEPTION 'ocade_generation_permits.task_id is missing';
  END IF;
END
$$;
