-- Rollback of 20261114230000: model spend is no longer summed for the ceilings.
BEGIN;
DROP FUNCTION IF EXISTS public.jarvis_model_tokens(uuid, timestamptz);
COMMIT;
