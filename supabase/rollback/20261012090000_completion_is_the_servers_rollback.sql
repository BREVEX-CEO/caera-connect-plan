-- Undo: the person's client may set completed again; a stopped claimed step keeps no outcome.
BEGIN;
DROP TRIGGER IF EXISTS jarvis_tasks_completion_is_the_servers ON public.jarvis_tasks;
DROP FUNCTION IF EXISTS public.jarvis_task_completion_is_the_servers();
DROP TRIGGER IF EXISTS jarvis_activity_stopped_while_running ON public.jarvis_activity;
DROP FUNCTION IF EXISTS public.jarvis_activity_stopped_while_running();
COMMIT;
