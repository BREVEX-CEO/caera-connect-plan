-- Reverses 20260909200000_ocade_monitors_and_browser_policy.sql.
--
-- DESTRUCTIVE: dropping these discards every monitor somebody configured and
-- every site permission they granted. Losing the permissions fails SAFE — with
-- no row, nothing is allowed — but they cannot be reconstructed and would have
-- to be granted again, one site at a time.

BEGIN;

DROP TABLE IF EXISTS public.ocade_browser_site_policy;
DROP TABLE IF EXISTS public.ocade_monitors;

COMMIT;
