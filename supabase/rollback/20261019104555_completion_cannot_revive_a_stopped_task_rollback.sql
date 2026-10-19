-- Removes only the new transition guard. Existing completion/charge guards stay intact.
-- No data is changed. The previous server must not be used to complete stopped tasks.
BEGIN;
DROP TRIGGER IF EXISTS jarvis_completion_requires_running ON public.jarvis_tasks;
DROP FUNCTION IF EXISTS public.jarvis_completion_requires_running();
COMMIT;
