-- Rollback for the subscriptions table and its entitlement helper.
--
-- Subscription rows are the record of money already taken, so this rollback
-- drops the helper function and access policy but KEEPS the table: undoing a
-- schema change must never destroy billing history. Drop the table by hand
-- only after the rows have been exported.

BEGIN;

DROP FUNCTION IF EXISTS public.has_active_subscription(uuid, text);

DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;

REVOKE ALL ON TABLE public.subscriptions FROM PUBLIC, anon, authenticated;

DROP INDEX IF EXISTS public.idx_subscriptions_paddle_id;
DROP INDEX IF EXISTS public.idx_subscriptions_user_id;

COMMIT;
