-- Rollback of 20261118100000: per-call model records are removed.
BEGIN;
DROP FUNCTION IF EXISTS public.ocade_record_model_call(uuid, text, text, text, text, integer, integer);
DROP TABLE IF EXISTS public.model_calls;
COMMIT;
