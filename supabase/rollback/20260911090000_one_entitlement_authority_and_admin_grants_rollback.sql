-- Restores the second subscription table and removes the grant system.
--
-- WHAT COMES BACK AND WHAT DOES NOT. `ocade_subscriptions` is recreated with
-- its original shape and refilled from the archive, so the rows survive the
-- round trip. The archive table is left in place: it is evidence, and a
-- rollback that deletes the record of what was archived covers its own tracks.
--
-- THE GRANTS ARE DROPPED, AND THAT IS DESTRUCTIVE. Rolling this back removes
-- every entitlement OCADE decided to give, along with who gave it and why. Read
-- `ocade_entitlement_grants` first if any row exists; there is no other copy.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ocade_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  catalogue_version TEXT NOT NULL DEFAULT 'free_pro_max_v1',
  CHECK (expires_at > started_at)
);

INSERT INTO public.ocade_subscriptions (
  id, user_id, plan_id, started_at, expires_at, status, created_at, updated_at, catalogue_version
)
SELECT id, user_id, plan_id, started_at, expires_at, status, created_at, updated_at,
       COALESCE(catalogue_version, 'free_pro_max_v1')
  FROM public.ocade_retired_subscriptions
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.ocade_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ocade_subscriptions FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.ocade_subscriptions TO authenticated;
GRANT ALL ON TABLE public.ocade_subscriptions TO service_role;

DROP POLICY IF EXISTS "own_subscription_read" ON public.ocade_subscriptions;
CREATE POLICY "own_subscription_read" ON public.ocade_subscriptions FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS ocade_subscriptions_user_idx
  ON public.ocade_subscriptions (user_id, expires_at DESC);

DROP POLICY IF EXISTS subscriptions_admin_read ON public.subscriptions;
DROP POLICY IF EXISTS payment_events_admin_read ON public.ocade_payment_events;
DROP POLICY IF EXISTS invoices_admin_read ON public.ocade_invoices;
DROP POLICY IF EXISTS retired_subscription_admin_read ON public.ocade_retired_subscriptions;

DROP FUNCTION IF EXISTS public.ocade_admin_seat_overview();
DROP FUNCTION IF EXISTS public.ocade_my_entitlement_grant();
DROP FUNCTION IF EXISTS public.ocade_revoke_entitlement(UUID, TEXT);
DROP FUNCTION IF EXISTS public.ocade_grant_entitlement(UUID, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.ocade_active_entitlement_grant(UUID);
DROP TABLE IF EXISTS public.ocade_entitlement_grants;

COMMIT;
