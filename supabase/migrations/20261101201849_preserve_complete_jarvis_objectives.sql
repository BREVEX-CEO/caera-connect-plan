-- Preserve the complete request the task authority already uses as its title.
-- No execution authority, grants, status or existing data is changed.
BEGIN;
ALTER TABLE public.jarvis_tasks DROP CONSTRAINT jarvis_tasks_title_check;
ALTER TABLE public.jarvis_tasks ADD CONSTRAINT jarvis_tasks_title_check
  CHECK (length(btrim(title)) BETWEEN 1 AND 8000);
COMMIT;
