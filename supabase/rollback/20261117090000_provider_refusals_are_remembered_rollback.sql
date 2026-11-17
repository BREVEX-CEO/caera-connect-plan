-- Rollback of 20261117090000: provider refusals are no longer remembered across instances.
BEGIN;
DROP FUNCTION IF EXISTS public.ocade_learn_provider_refusal(text, text);
DROP FUNCTION IF EXISTS public.ocade_provider_refusals(text);
DROP TABLE IF EXISTS private.provider_refusals;
COMMIT;
