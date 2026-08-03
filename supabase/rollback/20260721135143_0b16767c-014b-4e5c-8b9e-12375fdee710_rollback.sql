-- Rollback for 20260721135143 (data_class_privacy + vault_config).
-- Idempotent, reverse order. Not applied automatically here.
BEGIN;
DROP TABLE IF EXISTS public.vault_config CASCADE;
DROP TABLE IF EXISTS public.data_class_privacy CASCADE;
COMMIT;
