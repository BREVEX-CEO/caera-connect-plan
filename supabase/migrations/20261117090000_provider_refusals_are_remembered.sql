-- Plan v8 10.8 / 25.3: the request settings a model's provider refused (thinking, a forced call,
-- the full JSON Schema, a system instruction) are remembered across server instances, so a cold
-- instance does not send a refused setting again. A refusal is forgotten after 30 days, so a
-- provider that adds the setting is asked again. Identifiers only; service role only.
BEGIN;

CREATE TABLE IF NOT EXISTS private.provider_refusals (
  model text NOT NULL CHECK (char_length(model) BETWEEN 1 AND 300),
  feature text NOT NULL CHECK (feature IN ('thinking', 'forced_call', 'json_schema', 'system_instruction')),
  learned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (model, feature)
);
REVOKE ALL ON private.provider_refusals FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ocade_provider_refusals(p_model text)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT coalesce(array_agg(r.feature ORDER BY r.feature), '{}')
    FROM private.provider_refusals AS r
   WHERE r.model = p_model AND r.learned_at > now() - interval '30 days';
$$;

CREATE OR REPLACE FUNCTION public.ocade_learn_provider_refusal(p_model text, p_feature text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  INSERT INTO private.provider_refusals (model, feature) VALUES (p_model, p_feature)
  ON CONFLICT (model, feature) DO UPDATE SET learned_at = now();
$$;

REVOKE ALL ON FUNCTION public.ocade_provider_refusals(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_learn_provider_refusal(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_provider_refusals(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ocade_learn_provider_refusal(text, text) TO service_role;

COMMIT;
