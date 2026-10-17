-- Undo 20261017110000: a spent recovery code is simply spent again, whatever followed.
BEGIN;
DROP FUNCTION IF EXISTS public.ocade_finish_mfa_recovery(uuid, text);
DROP FUNCTION IF EXISTS public.ocade_begin_mfa_recovery(uuid, text, uuid, text[]);
ALTER TABLE public.ocade_mfa_recovery_codes
  DROP COLUMN IF EXISTS recovered_at,
  DROP COLUMN IF EXISTS recovering_factors,
  DROP COLUMN IF EXISTS recovering_session;
COMMIT;
