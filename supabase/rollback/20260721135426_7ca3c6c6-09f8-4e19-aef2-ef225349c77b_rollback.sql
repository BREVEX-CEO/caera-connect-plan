-- Rollback for 20260721135426 (user_private_records).
-- Idempotent. Not applied automatically here.
BEGIN;
DROP TABLE IF EXISTS public.user_private_records CASCADE;
COMMIT;
