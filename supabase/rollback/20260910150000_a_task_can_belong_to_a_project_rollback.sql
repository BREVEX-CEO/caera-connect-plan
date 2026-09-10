-- Reverses 20260910150000_a_task_can_belong_to_a_project.sql.
--
-- Dropping the column loses which project each task belonged to, and there is
-- nowhere else that fact is written down — so the relationships are recorded in
-- the task's own `current_step` before the column goes, where a person can read
-- them and refile by hand. Rolling a feature back is not a reason to make
-- somebody's filing unrecoverable.

BEGIN;

UPDATE public.ocade_tasks AS t
   SET current_step = COALESCE(t.current_step || ' · ', '')
                      || 'Was filed under project ' || p.name
  FROM public.ocade_projects AS p
 WHERE t.project_id = p.id;

DROP INDEX IF EXISTS public.ocade_tasks_project_idx;

ALTER TABLE public.ocade_tasks DROP COLUMN IF EXISTS project_id;

COMMIT;
