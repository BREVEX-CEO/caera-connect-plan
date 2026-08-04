-- Rollback for 20260721160854 (profiles full_name/preferred_name/occupation/custom_instructions). Idempotent.
BEGIN;
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS custom_instructions,
  DROP COLUMN IF EXISTS occupation,
  DROP COLUMN IF EXISTS preferred_name,
  DROP COLUMN IF EXISTS full_name;
COMMIT;
