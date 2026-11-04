-- Rollback of 20261104092007_busy_planner_resumes_itself.sql: restores what it replaced and removes what it added.
-- Data in removed columns is lost; nothing else changes.
BEGIN;

DROP TRIGGER IF EXISTS jarvis_retry_only_while_busy ON public.jarvis_tasks;
DROP FUNCTION IF EXISTS public.jarvis_retry_only_while_busy();

DROP FUNCTION IF EXISTS public.jarvis_task_wait_until(uuid, uuid, text, timestamptz);

DROP FUNCTION IF EXISTS public.jarvis_resume_due(uuid);

ALTER TABLE public.jarvis_tasks DROP COLUMN IF EXISTS retry_at;

COMMIT;
