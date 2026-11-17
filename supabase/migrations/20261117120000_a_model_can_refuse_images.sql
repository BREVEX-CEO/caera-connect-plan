-- Threat O-02 / plan 14B.1A.8: a model's provider can refuse images too. That refusal is
-- remembered like the others, so a text-only model is never sent a screenshot again and the
-- planner is told it cannot see. Identifiers only; service role only.
BEGIN;
ALTER TABLE private.provider_refusals DROP CONSTRAINT IF EXISTS provider_refusals_feature_check;
ALTER TABLE private.provider_refusals ADD CONSTRAINT provider_refusals_feature_check
  CHECK (feature IN ('thinking', 'forced_call', 'json_schema', 'system_instruction', 'vision'));
COMMIT;
