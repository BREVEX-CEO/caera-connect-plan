-- Plan 14D.4.3: a customer's own connection may speak Anthropic's Messages API as well as
-- Google's generateContent and OpenAI's chat completions. Only the allowed values change.
BEGIN;
ALTER TABLE public.byok_connections DROP CONSTRAINT IF EXISTS byok_connections_protocol_check;
ALTER TABLE public.byok_connections
  ADD CONSTRAINT byok_connections_protocol_check
  CHECK (protocol IN ('gemini', 'openai', 'anthropic'));
COMMIT;
