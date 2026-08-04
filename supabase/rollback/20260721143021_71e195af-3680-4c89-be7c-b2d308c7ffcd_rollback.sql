-- Rollback for 20260721143021 (OCADE provider prefs + provider events).
-- Idempotent, reverse order. Not applied automatically here.
BEGIN;
DROP TABLE IF EXISTS public.ocade_provider_events CASCADE;
DROP TABLE IF EXISTS public.ocade_provider_prefs CASCADE;
COMMIT;
