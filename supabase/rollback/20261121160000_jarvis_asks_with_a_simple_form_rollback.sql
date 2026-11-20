-- Rollback of 20261121160000: JARVIS asks only free-text questions again.
BEGIN;
DROP FUNCTION IF EXISTS public.jarvis_answer_form(uuid, uuid, jsonb, uuid);
DROP FUNCTION IF EXISTS public.jarvis_task_ask_form(uuid, uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.jarvis_form_valid(jsonb);
COMMIT;
