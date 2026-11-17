-- Rollback of 20261117120000: image refusals are no longer remembered.
BEGIN;
DELETE FROM private.provider_refusals WHERE feature = 'vision';
ALTER TABLE private.provider_refusals DROP CONSTRAINT IF EXISTS provider_refusals_feature_check;
ALTER TABLE private.provider_refusals ADD CONSTRAINT provider_refusals_feature_check
  CHECK (feature IN ('thinking', 'forced_call', 'json_schema', 'system_instruction'));
COMMIT;
