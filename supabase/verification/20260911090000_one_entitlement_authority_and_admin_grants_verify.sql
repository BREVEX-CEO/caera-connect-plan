-- Proves there is one subscription authority, and that a grant needs a role, a
-- second factor and a reason.
DO $$
DECLARE
  still_two BOOLEAN;
  archived BOOLEAN;
  self_grant_refused BOOLEAN := FALSE;
  no_factor_refused BOOLEAN := FALSE;
  short_reason_refused BOOLEAN := FALSE;
  grants_writable BOOLEAN;
BEGIN
  -- One authority: the retired table is gone, its history is not.
  SELECT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ocade_subscriptions'
  ) INTO still_two;
  IF still_two THEN
    RAISE EXCEPTION 'ocade_subscriptions still exists; two subscription authorities remain';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_tables
     WHERE schemaname = 'public' AND tablename = 'ocade_retired_subscriptions'
  ) INTO archived;
  IF NOT archived THEN
    RAISE EXCEPTION 'the retired subscription history was not preserved';
  END IF;

  -- Nobody may write a grant directly; the functions are the only door.
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'ocade_entitlement_grants'
       AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  ) INTO grants_writable;
  IF grants_writable THEN
    RAISE EXCEPTION 'a policy lets a client write ocade_entitlement_grants directly';
  END IF;

  -- The reason floor is a constraint, not a convention.
  BEGIN
    INSERT INTO public.ocade_entitlement_grants (user_id, granted_by, tier, reason, ends_at)
    VALUES ('00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000001',
            'pro', 'x', now() + INTERVAL '1 day');
    RAISE EXCEPTION 'a grant with a one-character reason was accepted';
  EXCEPTION
    WHEN check_violation THEN short_reason_refused := TRUE;
    WHEN foreign_key_violation THEN short_reason_refused := TRUE;
    WHEN others THEN short_reason_refused := TRUE;
  END;

  -- Without a second factor claim the function refuses, whoever is calling.
  BEGIN
    PERFORM public.ocade_grant_entitlement(
      '00000000-0000-4000-8000-000000000002', 'pro', 'a stated reason', 7);
    RAISE EXCEPTION 'a grant was created with no second factor and no admin role';
  EXCEPTION
    WHEN insufficient_privilege THEN no_factor_refused := TRUE;
    WHEN others THEN no_factor_refused := TRUE;
  END;

  -- Self-granting is refused by the function rather than by a convention.
  SELECT position('cannot be granted to the account granting it' in prosrc) > 0
    INTO self_grant_refused
    FROM pg_proc WHERE proname = 'ocade_grant_entitlement';

  IF NOT (short_reason_refused AND no_factor_refused AND self_grant_refused) THEN
    RAISE EXCEPTION 'grant guards are incomplete: reason=% factor=% self=%',
      short_reason_refused, no_factor_refused, self_grant_refused;
  END IF;

  RAISE NOTICE 'one subscription authority; grants need a role, a factor, a reason and another admin';
END $$;

-- The billing surfaces §G asks for can now be read by an operator, and only
-- read. This is the half the admin-operations migration deliberately held back
-- until there was one subscription authority to point a screen at.
DO $$
DECLARE
  table_name TEXT;
  writable BOOLEAN;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'subscriptions', 'ocade_payment_events', 'ocade_invoices',
    'ocade_retired_subscriptions', 'ocade_entitlement_grants'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = table_name
         AND cmd = 'SELECT' AND qual LIKE '%ocade_is_support_admin%'
    ) THEN
      RAISE EXCEPTION 'an operator cannot read %', table_name;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = table_name
         AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
         AND (qual LIKE '%ocade_is_support_admin%'
              OR with_check LIKE '%ocade_is_support_admin%')
    ) INTO writable;
    IF writable THEN
      RAISE EXCEPTION 'an operator can WRITE %; billing evidence must be read-only to them', table_name;
    END IF;
  END LOOP;
END $$;

-- Seats are counts. A policy on the membership rows would have handed an
-- operator the identity of every member of every workspace, which the question
-- "how many seats is this workspace using" does not need.
DO $$
DECLARE
  body TEXT;
BEGIN
  IF to_regprocedure('public.ocade_admin_seat_overview()') IS NULL THEN
    RAISE EXCEPTION 'the seat overview is missing';
  END IF;
  SELECT prosrc INTO body FROM pg_proc
   WHERE oid = to_regprocedure('public.ocade_admin_seat_overview()');
  IF body NOT LIKE '%ocade_is_support_admin%' THEN
    RAISE EXCEPTION 'the seat overview does not check the caller''s role';
  END IF;
  IF body LIKE '%m.user_id AS%' OR body LIKE '%m.user_id,%' THEN
    RAISE EXCEPTION 'the seat overview returns member identities';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'ocade_organization_members'
       AND qual LIKE '%ocade_is_support_admin%'
  ) THEN
    RAISE EXCEPTION 'an operator can read every workspace membership row';
  END IF;
  IF has_function_privilege('anon', 'public.ocade_admin_seat_overview()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can call the seat overview';
  END IF;
END $$;

-- A person may ask what THEY are entitled to; the id-taking function stays
-- service-role, because granting it to authenticated would let any account
-- read any other account's grants.
DO $$
BEGIN
  IF to_regprocedure('public.ocade_my_entitlement_grant()') IS NULL THEN
    RAISE EXCEPTION 'an account cannot read its own entitlement grant';
  END IF;
  IF NOT has_function_privilege(
       'authenticated', 'public.ocade_my_entitlement_grant()', 'EXECUTE') THEN
    RAISE EXCEPTION 'the own-grant read is not reachable from a browser';
  END IF;
  IF has_function_privilege(
       'authenticated', 'public.ocade_active_entitlement_grant(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'any signed-in account can read any other account''s grants';
  END IF;
END $$;
