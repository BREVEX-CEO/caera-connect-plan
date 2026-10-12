-- Undo: no consent record (the Online boundary must be rolled back with it).
BEGIN;
DROP FUNCTION IF EXISTS public.ocade_record_online_ai_consent(text, boolean);
ALTER TABLE public.profiles DROP COLUMN IF EXISTS online_ai_consent_version;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS online_ai_consent_at;
COMMIT;
