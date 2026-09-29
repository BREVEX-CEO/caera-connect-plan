-- Remove the emergency stop. The Worker variable JARVIS_EXECUTION_DISABLED still works.
BEGIN;
DROP FUNCTION IF EXISTS public.ocade_read_service_controls();
DROP FUNCTION IF EXISTS public.ocade_set_service_control(text, boolean, text);
DROP TABLE IF EXISTS public.ocade_service_control_events;
DROP TABLE IF EXISTS public.ocade_service_controls;
COMMIT;
