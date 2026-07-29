-- Rollback for 20260721143529 (CANIA saved topics, alert prefs, settings).
-- Idempotent. Not applied automatically here.
BEGIN;
DROP TABLE IF EXISTS public.cania_settings CASCADE;
DROP TABLE IF EXISTS public.cania_alert_prefs CASCADE;
DROP TABLE IF EXISTS public.cania_saved_topics CASCADE;
COMMIT;
