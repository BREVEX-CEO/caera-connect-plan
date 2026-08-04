-- ROLLBACK for 20260722100000_ocade_subscriptions_usage.sql
--
-- Destructive: removes subscription records and the cloud-usage ledger.
-- Local capabilities are unaffected (they were never gated by these tables).

BEGIN;

DROP FUNCTION IF EXISTS public.ocade_consume_cloud_use(UUID, TIMESTAMPTZ, INTEGER);

DROP TRIGGER IF EXISTS ocade_cloud_usage_touch ON public.ocade_cloud_usage;
DROP TABLE IF EXISTS public.ocade_cloud_usage;

DROP TRIGGER IF EXISTS ocade_subscriptions_touch ON public.ocade_subscriptions;
DROP TABLE IF EXISTS public.ocade_subscriptions;

COMMIT;
