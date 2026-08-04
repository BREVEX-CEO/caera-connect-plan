-- Rollback for 20260721150450 (create_company_with_owner redefined with (_uid, _payload)).
-- Drops the new two-arg signature; the earlier one-arg version (migration 150351)
-- has its own rollback. Idempotent. Not applied automatically.
BEGIN;
DROP FUNCTION IF EXISTS public.create_company_with_owner(uuid, jsonb);
COMMIT;
