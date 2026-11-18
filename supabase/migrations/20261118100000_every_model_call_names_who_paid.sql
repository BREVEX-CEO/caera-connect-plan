-- Plan 14B.1B.3: one append-only record per answered model turn, naming the source that paid for
-- it: OCADE's own keys (which key slot, for the operator only) or the customer's own connection.
-- Tokens are the provider's own counts; nothing of the conversation and no key is kept. A person
-- reads their own records, without OCADE's key slot; only OCADE's server writes them, and no one
-- changes them.
BEGIN;

CREATE TABLE public.model_calls (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  surface text NOT NULL CHECK (char_length(surface) BETWEEN 1 AND 40),
  source text NOT NULL CHECK (source IN ('ocade', 'customer')),
  connection_id uuid REFERENCES public.byok_connections (id) ON DELETE SET NULL,
  key_slot text CHECK (key_slot IS NULL OR char_length(key_slot) BETWEEN 1 AND 60),
  model text NOT NULL CHECK (char_length(model) BETWEEN 1 AND 200),
  input_tokens integer CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens integer CHECK (output_tokens IS NULL OR output_tokens >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((source = 'ocade') = (key_slot IS NOT NULL)),
  CHECK (source = 'customer' OR connection_id IS NULL)
);
CREATE INDEX model_calls_user_time ON public.model_calls (user_id, created_at DESC);
ALTER TABLE public.model_calls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.model_calls FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT (id, surface, source, connection_id, model, input_tokens, output_tokens, created_at)
  ON public.model_calls TO authenticated;
GRANT SELECT ON public.model_calls TO service_role;
CREATE POLICY model_calls_own ON public.model_calls
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE FUNCTION public.ocade_record_model_call(
  p_user_id uuid, p_surface text, p_source text, p_credential text, p_model text,
  p_input_tokens integer, p_output_tokens integer
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  INSERT INTO public.model_calls (user_id, surface, source, connection_id, key_slot, model,
                                  input_tokens, output_tokens)
  SELECT p_user_id, p_surface, p_source,
         CASE WHEN p_source = 'customer' THEN c.id END,
         CASE WHEN p_source = 'ocade' THEN left(p_credential, 60) END,
         p_model, p_input_tokens, p_output_tokens
    FROM (SELECT 1) AS one
    LEFT JOIN public.byok_connections AS c
      ON p_source = 'customer' AND c.id::text = p_credential AND c.user_id = p_user_id
   -- A customer turn is recorded only against that customer's own connection.
   WHERE p_source = 'ocade' OR c.id IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.ocade_record_model_call(uuid, text, text, text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_record_model_call(uuid, text, text, text, text, integer, integer)
  TO service_role;

COMMIT;
