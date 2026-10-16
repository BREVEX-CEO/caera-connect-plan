-- Queue admission holds the task: the activity's controller exists and the guard checks it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'jarvis_activity' AND column_name = 'controller') THEN
    RAISE EXCEPTION 'jarvis_activity.controller is missing';
  END IF;
  IF position('Another loop controls that task' IN
              pg_get_functiondef('public.jarvis_no_action_after_completion()'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'queue admission does not check the controlling loop';
  END IF;
END
$$;
