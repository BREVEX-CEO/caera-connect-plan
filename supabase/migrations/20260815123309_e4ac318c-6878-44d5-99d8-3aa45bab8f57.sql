-- OCADE subscriptions + cloud usage allowance (Plan §33/§38, decisions #11/#12/#35-#37).
--
-- READY TO APPLY — not yet applied. Local processing is unlimited and is never
-- recorded here; only OCADE Cloud requests consume allowance.
-- Rollback:    supabase/rollback/20260722100000_ocade_subscriptions_usage_rollback.sql
-- Verification: supabase/verification/20260722100000_ocade_subscriptions_usage_verify.sql

BEGIN;

-- ----------------------------------------------------------- subscriptions --
CREATE TABLE IF NOT EXISTS public.ocade_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('trial_2d', 'std_8d', 'month_1m', 'year_1y')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_at > started_at)
);

REVOKE ALL ON TABLE public.ocade_subscriptions FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.ocade_subscriptions TO authenticated;
GRANT ALL ON TABLE public.ocade_subscriptions TO service_role;

ALTER TABLE public.ocade_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users may READ their own subscription. Writes are server/service-role only so
-- a client can never grant itself entitlement.
DROP POLICY IF EXISTS "own_subscription_read" ON public.ocade_subscriptions;
CREATE POLICY "own_subscription_read" ON public.ocade_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS ocade_subscriptions_user_idx
  ON public.ocade_subscriptions (user_id, expires_at DESC);

DROP TRIGGER IF EXISTS ocade_subscriptions_touch ON public.ocade_subscriptions;
CREATE TRIGGER ocade_subscriptions_touch
  BEFORE UPDATE ON public.ocade_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------ cloud usage --
-- One row per user per fixed 8-hour window (aligned to UTC midnight).
-- LOCAL inference is unlimited and is never written here.
CREATE TABLE IF NOT EXISTS public.ocade_cloud_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, window_start)
);

REVOKE ALL ON TABLE public.ocade_cloud_usage FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.ocade_cloud_usage TO authenticated;
GRANT ALL ON TABLE public.ocade_cloud_usage TO service_role;

ALTER TABLE public.ocade_cloud_usage ENABLE ROW LEVEL SECURITY;

-- Read-only to the owner; increments are performed server-side so a client
-- cannot reset or under-report its own usage.
DROP POLICY IF EXISTS "own_usage_read" ON public.ocade_cloud_usage;
CREATE POLICY "own_usage_read" ON public.ocade_cloud_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS ocade_cloud_usage_user_window_idx
  ON public.ocade_cloud_usage (user_id, window_start DESC);

DROP TRIGGER IF EXISTS ocade_cloud_usage_touch ON public.ocade_cloud_usage;
CREATE TRIGGER ocade_cloud_usage_touch
  BEFORE UPDATE ON public.ocade_cloud_usage
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Atomic increment used by the server after a SUCCESSFUL cloud request only.
-- Failed, cancelled and system-retried requests are never charged.
CREATE OR REPLACE FUNCTION public.ocade_consume_cloud_use(
  p_user_id UUID,
  p_window_start TIMESTAMPTZ,
  p_limit INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used INTEGER;
BEGIN
  INSERT INTO public.ocade_cloud_usage (user_id, window_start, used_count)
  VALUES (p_user_id, p_window_start, 1)
  ON CONFLICT (user_id, window_start)
  DO UPDATE SET used_count = public.ocade_cloud_usage.used_count + 1
  RETURNING used_count INTO v_used;

  IF v_used > p_limit THEN
    RAISE EXCEPTION 'allowance_exhausted' USING ERRCODE = 'check_violation';
  END IF;

  RETURN v_used;
END;
$$;

REVOKE ALL ON FUNCTION public.ocade_consume_cloud_use(UUID, TIMESTAMPTZ, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ocade_consume_cloud_use(UUID, TIMESTAMPTZ, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.ocade_consume_cloud_use(UUID, TIMESTAMPTZ, INTEGER) TO service_role;

COMMENT ON TABLE public.ocade_cloud_usage IS
  'OCADE Cloud allowance ledger (28 per fixed 8-hour UTC window). Local inference is unlimited and never recorded here.';

COMMIT;