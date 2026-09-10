-- Verifies 20260910150000_a_task_can_belong_to_a_project.sql.
--
-- Three claims, each checked against the database rather than the migration
-- text: the relationship exists, deleting a project unfiles the task instead of
-- destroying it, and the question a project workspace asks has an index.

DO $$
DECLARE
  probe_user uuid := gen_random_uuid();
  project uuid;
  task uuid;
  still_there integer;
  filed uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'ocade_tasks'
       AND column_name = 'project_id'
  ) THEN
    RAISE EXCEPTION 'ocade_tasks has no project_id, so a task cannot be filed with the work it belongs to';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class
     WHERE relname = 'ocade_tasks_project_idx'
       AND relnamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'the project link has no index, so "what belongs to this project" scans every task on the account';
  END IF;

  INSERT INTO auth.users (id, email)
  VALUES (probe_user, 'task-project-probe-' || probe_user || '@invalid.test');

  INSERT INTO public.ocade_projects (user_id, name)
  VALUES (probe_user, 'Probe project')
  RETURNING id INTO project;

  INSERT INTO public.ocade_tasks (user_id, source, title, status, project_id)
  VALUES (probe_user, 'work', 'Probe task', 'CREATED', project)
  RETURNING id INTO task;

  SELECT project_id INTO filed FROM public.ocade_tasks WHERE id = task;
  IF filed IS DISTINCT FROM project THEN
    RAISE EXCEPTION 'the task did not keep the project it was filed under';
  END IF;

  -- Deleting the project must keep the work and unfile it.
  DELETE FROM public.ocade_projects WHERE id = project;

  SELECT count(*) INTO still_there FROM public.ocade_tasks WHERE id = task;
  IF still_there <> 1 THEN
    RAISE EXCEPTION 'deleting a project deleted the task with it';
  END IF;

  SELECT project_id INTO filed FROM public.ocade_tasks WHERE id = task;
  IF filed IS NOT NULL THEN
    RAISE EXCEPTION 'the task still points at a project that no longer exists';
  END IF;

  DELETE FROM auth.users WHERE id = probe_user;
END;
$$;
