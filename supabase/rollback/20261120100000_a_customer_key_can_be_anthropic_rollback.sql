-- Rollback of 20261120100000: Anthropic connections are removed first (they cannot exist under
-- the earlier rule), then the earlier two protocols are the only ones allowed again.
BEGIN;
DELETE FROM public.byok_connections WHERE protocol = 'anthropic';
ALTER TABLE public.byok_connections DROP CONSTRAINT IF EXISTS byok_connections_protocol_check;
ALTER TABLE public.byok_connections
  ADD CONSTRAINT byok_connections_protocol_check CHECK (protocol IN ('gemini', 'openai'));
COMMIT;
