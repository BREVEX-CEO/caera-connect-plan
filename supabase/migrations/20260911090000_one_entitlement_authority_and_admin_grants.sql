-- One authority for commercial access, and grants that are not fake payments.
--
-- `PLAN.md` Phase 19: "Merge historical subscription/payment authorities into
-- one server-authoritative billing-event/subscription/entitlement system while
-- preserving history ... Admin grants are separate entitlements, never fake
-- payments."
--
-- WHAT WAS ACTUALLY THERE — TWO SUBSCRIPTION TABLES, WRITTEN BY DIFFERENT CODE,
-- READ BY DIFFERENT CODE.
--
--   `public.subscriptions` is what the signature-verified Paddle webhook
--   writes, through `apply_payment_webhook_event`, with idempotency by event id
--   and ordering by the provider's own timestamp.
--
--   `public.ocade_subscriptions` is what `entitlement-resolver.ts` reads to
--   decide which tier an account is on.
--
-- Nothing wrote the table the resolver read. A customer could complete a real
-- payment, have it verified, recorded and audited — and still be on Free,
-- because the row landed in the other table. That is not a missing feature; it
-- is money taken for access not granted, and it is `ADMIN-002`'s "defect
-- underneath" the missing admin screen.
--
-- HISTORY IS PRESERVED, NOT TRANSLATED. `ocade_subscriptions` rows name plans
-- from a retired catalogue (`trial_2d`, `std_8d`) that no current price sells.
-- Rewriting one into a provider subscription would invent a payment that never
-- happened, so they are copied verbatim into `ocade_retired_subscriptions` —
-- readable, auditable, and granting nothing.
--
-- ADMIN GRANTS ARE THEIR OWN THING. A grant is an entitlement OCADE decided to
-- give, recorded as exactly that, with who gave it, why, for how long, and
-- whether it was revoked. It is never written into the provider table, because
-- a support decision that looks like a completed payment is a lie to
-- accounting, to the customer and to whoever reads the row next year.

BEGIN;

-- ------------------------------------------------- the retired authority --

CREATE TABLE IF NOT EXISTS public.ocade_retired_subscriptions (
  id UUID PRIMARY KEY,
  /*
   * STILL TIED TO THE ACCOUNT, AND STILL CASCADING.
   *
   * The archive is history, but it is the customer's history: it is exported
   * with their billing records and it is theirs to read. A `user_id` that
   * referenced nothing would be an id the export cannot join and the account
   * deletion cannot reach — the same orphan the retired table never was, since
   * it carried this exact constraint.
   */
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  catalogue_version TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  retired_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ocade_retired_subscriptions IS
  'History from the retired ocade_subscriptions table. Read-only evidence: it grants no entitlement and nothing reads it to decide access.';

INSERT INTO public.ocade_retired_subscriptions (
  id, user_id, plan_id, started_at, expires_at, status, catalogue_version, created_at, updated_at
)
SELECT id, user_id, plan_id, started_at, expires_at, status,
       catalogue_version, created_at, updated_at
  FROM public.ocade_subscriptions
ON CONFLICT (id) DO NOTHING;

DROP TABLE IF EXISTS public.ocade_subscriptions;

-- The cascade path and the own-history read use the same index.
CREATE INDEX IF NOT EXISTS ocade_retired_subscriptions_user_idx
  ON public.ocade_retired_subscriptions (user_id, expires_at DESC);

ALTER TABLE public.ocade_retired_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ocade_retired_subscriptions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ocade_retired_subscriptions TO service_role;

/* A person may read their own history. Nobody may write it. */
DROP POLICY IF EXISTS "retired_subscription_own_read" ON public.ocade_retired_subscriptions;
CREATE POLICY "retired_subscription_own_read" ON public.ocade_retired_subscriptions
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
GRANT SELECT ON public.ocade_retired_subscriptions TO authenticated;

-- -------------------------------------------------------- admin grants --

CREATE TABLE IF NOT EXISTS public.ocade_entitlement_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The IMMUTABLE Auth user id is the mutation target. An email may find the
  -- account; it never identifies it, because an email can be changed and
  -- re-registered while the id cannot.
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  tier TEXT NOT NULL CHECK (tier IN ('pro', 'max')),
  -- A reason somebody could read back in an audit. Ten characters is not a
  -- quality bar; it is a floor under "x".
  reason TEXT NOT NULL CHECK (length(btrim(reason)) >= 10),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ocade_entitlement_grants_window_check CHECK (ends_at > starts_at),
  -- A year is long; forever is not a grant, it is a pricing decision nobody
  -- made. An indefinite grant would also never appear in a review.
  CONSTRAINT ocade_entitlement_grants_max_window_check
    CHECK (ends_at <= starts_at + INTERVAL '366 days')
);

COMMENT ON TABLE public.ocade_entitlement_grants IS
  'Entitlement OCADE decided to give: who gave it, to whom, why, for how long, and whether it was revoked. Never a payment record.';

CREATE INDEX IF NOT EXISTS ocade_entitlement_grants_user_idx
  ON public.ocade_entitlement_grants (user_id, ends_at DESC);
CREATE INDEX IF NOT EXISTS ocade_entitlement_grants_granted_by_idx
  ON public.ocade_entitlement_grants (granted_by, created_at DESC);

ALTER TABLE public.ocade_entitlement_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ocade_entitlement_grants FROM PUBLIC, anon;
GRANT SELECT ON public.ocade_entitlement_grants TO authenticated;
GRANT ALL ON public.ocade_entitlement_grants TO service_role;

/*
 * A person sees the grants they hold; nobody writes this table directly.
 *
 * Writes go through the functions below, which check the role, the second
 * factor and the reason. A policy that let an admin INSERT would be a policy
 * that let an admin grant themselves Max with no reason and no record of why.
 */
DROP POLICY IF EXISTS "entitlement_grants_own_read" ON public.ocade_entitlement_grants;
CREATE POLICY "entitlement_grants_own_read" ON public.ocade_entitlement_grants
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

/*
 * The strongest grant an account currently holds, or NULL.
 *
 * STABLE and SECURITY DEFINER so the entitlement resolver can ask without the
 * caller's own policies deciding the answer — an account that could hide its
 * own grant could not be billed correctly, and one that could see another's
 * could spend it.
 */
DROP FUNCTION IF EXISTS public.ocade_active_entitlement_grant(UUID);
CREATE OR REPLACE FUNCTION public.ocade_active_entitlement_grant(target_user UUID)
RETURNS TABLE (tier TEXT, starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ, reason TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.tier, g.starts_at, g.ends_at, g.reason
    FROM public.ocade_entitlement_grants g
   WHERE g.user_id = target_user
     AND g.revoked_at IS NULL
     AND g.starts_at <= now()
     AND g.ends_at > now()
   -- Max outranks Pro, and a longer window wins a tie, so an account never
   -- loses access it was given because a second, smaller grant exists.
   ORDER BY CASE g.tier WHEN 'max' THEN 2 ELSE 1 END DESC, g.ends_at DESC
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.ocade_active_entitlement_grant(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_active_entitlement_grant(UUID) TO service_role;

/*
 * Grant an entitlement. The only way a grant is ever created.
 *
 * THE SECOND FACTOR IS CHECKED HERE, not only in the application, for the same
 * reason the support-case function checks it: a server function that forgets
 * its middleware is a bug, and a database that trusts the application to have
 * remembered is a design.
 */
CREATE OR REPLACE FUNCTION public.ocade_grant_entitlement(
  target_user UUID,
  grant_tier TEXT,
  grant_reason TEXT,
  days INTEGER DEFAULT 30
)
RETURNS public.ocade_entitlement_grants
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  created public.ocade_entitlement_grants;
BEGIN
  IF NOT private.ocade_is_support_admin() THEN
    RAISE EXCEPTION 'Only support admins may grant an entitlement.' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(current_setting('request.jwt.claim.aal', true),
              (current_setting('request.jwt.claims', true)::json ->> 'aal')) IS DISTINCT FROM 'aal2' THEN
    RAISE EXCEPTION 'Granting an entitlement needs a recent second factor.' USING ERRCODE = '42501';
  END IF;

  IF days IS NULL OR days < 1 OR days > 366 THEN
    RAISE EXCEPTION 'A grant runs for between 1 and 366 days.' USING ERRCODE = '22023';
  END IF;

  /*
   * NOBODY GRANTS THEMSELVES. An admin who needs Pro on their own account asks
   * another admin, exactly as they would for any other privileged change, and
   * the record then shows two people rather than one.
   */
  IF target_user = (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'An entitlement cannot be granted to the account granting it.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.ocade_entitlement_grants (user_id, granted_by, tier, reason, ends_at)
  VALUES (target_user, (SELECT auth.uid()), grant_tier, grant_reason,
          now() + make_interval(days => days))
  RETURNING * INTO created;

  RETURN created;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_grant_entitlement(UUID, TEXT, TEXT, INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_grant_entitlement(UUID, TEXT, TEXT, INTEGER)
  TO authenticated, service_role;

/*
 * Revoke a grant. The row stays; only its state changes.
 *
 * Deleting it would erase the evidence that access was given, which is the
 * half of the record a dispute actually needs.
 */
CREATE OR REPLACE FUNCTION public.ocade_revoke_entitlement(
  grant_id UUID,
  revoke_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  affected INTEGER;
BEGIN
  IF NOT private.ocade_is_support_admin() THEN
    RAISE EXCEPTION 'Only support admins may revoke an entitlement.' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(current_setting('request.jwt.claim.aal', true),
              (current_setting('request.jwt.claims', true)::json ->> 'aal')) IS DISTINCT FROM 'aal2' THEN
    RAISE EXCEPTION 'Revoking an entitlement needs a recent second factor.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.ocade_entitlement_grants
     SET revoked_at = now(),
         revoked_by = (SELECT auth.uid()),
         revoked_reason = revoke_reason
   WHERE id = grant_id
     AND revoked_at IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_revoke_entitlement(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_revoke_entitlement(UUID, TEXT) TO authenticated, service_role;

/*
 * The same question, asked about oneself.
 *
 * The plan surface shows a person what they are entitled to, and it reads as
 * them. It cannot call the function above — that one takes a user id and is
 * SECURITY DEFINER, so granting it to `authenticated` would let any account
 * read any other account's grants. This one takes no argument and can only
 * ever mean the caller.
 *
 * It DELEGATES rather than restating the rule. "Which grant counts" is one
 * expression in one place; a second copy here is a second chance for the
 * screen and the entitlement to disagree about what somebody is paying for.
 */
CREATE OR REPLACE FUNCTION public.ocade_my_entitlement_grant()
RETURNS TABLE (tier TEXT, starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ, reason TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.tier, g.starts_at, g.ends_at, g.reason
    FROM public.ocade_active_entitlement_grant((SELECT auth.uid())) g;
$$;
REVOKE ALL ON FUNCTION public.ocade_my_entitlement_grant() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_my_entitlement_grant() TO authenticated, service_role;

-- ------------------------------------------ what a billing operator sees --

/*
 * `PLAN.md` §G: "billing and seat overview and payment-event state".
 *
 * HELD UNTIL NOW ON PURPOSE. The admin operations migration says why it left
 * these out: the deployment carried two subscription tables, and a screen that
 * picked one would have asserted an answer to the question this migration
 * exists to settle. It is settled above, so the reads are granted here.
 *
 * READ, NEVER WRITE, in every policy below. An operator who could edit a
 * subscription row could grant paid access by hand and leave a record that
 * looks like a payment — which is the exact thing the grant table exists to
 * make impossible.
 */
DROP POLICY IF EXISTS subscriptions_admin_read ON public.subscriptions;
CREATE POLICY subscriptions_admin_read ON public.subscriptions
  FOR SELECT TO authenticated USING (private.ocade_is_support_admin());

DROP POLICY IF EXISTS payment_events_admin_read ON public.ocade_payment_events;
CREATE POLICY payment_events_admin_read ON public.ocade_payment_events
  FOR SELECT TO authenticated USING (private.ocade_is_support_admin());

DROP POLICY IF EXISTS invoices_admin_read ON public.ocade_invoices;
CREATE POLICY invoices_admin_read ON public.ocade_invoices
  FOR SELECT TO authenticated USING (private.ocade_is_support_admin());

DROP POLICY IF EXISTS retired_subscription_admin_read ON public.ocade_retired_subscriptions;
CREATE POLICY retired_subscription_admin_read ON public.ocade_retired_subscriptions
  FOR SELECT TO authenticated USING (private.ocade_is_support_admin());

/*
 * Grants are read by the people who give them, because a grant nobody can
 * review is an audit record in name only. Writing still goes through the
 * functions.
 */
DROP POLICY IF EXISTS entitlement_grants_admin_read ON public.ocade_entitlement_grants;
CREATE POLICY entitlement_grants_admin_read ON public.ocade_entitlement_grants
  FOR SELECT TO authenticated USING (private.ocade_is_support_admin());

/**
 * Seats, as counts.
 *
 * The same shape as the notification-delivery aggregate and for the same
 * reason: the operational question is "how many seats is each organization
 * using", and answering it from the membership rows would hand an operator the
 * identity of every member of every workspace in the deployment. Counts answer
 * it; the rows are not needed and are not granted.
 */
CREATE OR REPLACE FUNCTION public.ocade_admin_seat_overview()
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  created_at TIMESTAMPTZ,
  seats BIGINT,
  admins BIGINT,
  pending_invites BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT private.ocade_is_support_admin() THEN
    RAISE EXCEPTION 'Only a support admin may read the seat overview.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT o.id,
         o.name,
         o.created_at,
         -- A deactivated member holds no seat. Counting them would tell an
         -- operator a workspace is at its limit when it is not.
         count(m.user_id) FILTER (WHERE m.state = 'active') AS seats,
         count(m.user_id) FILTER (WHERE m.state = 'active' AND m.role IN ('owner', 'admin'))
           AS admins,
         -- An invite that was revoked or has expired is not a seat somebody is
         -- about to take.
         (SELECT count(*) FROM public.ocade_organization_invites i
           WHERE i.organization_id = o.id
             AND i.accepted_at IS NULL
             AND i.revoked_at IS NULL
             AND i.expires_at > now()) AS pending_invites
    FROM public.ocade_organizations o
    LEFT JOIN public.ocade_organization_members m ON m.organization_id = o.id
   GROUP BY o.id, o.name, o.created_at
   ORDER BY count(m.user_id) FILTER (WHERE m.state = 'active') DESC, o.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_admin_seat_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_admin_seat_overview() TO authenticated, service_role;

COMMIT;
