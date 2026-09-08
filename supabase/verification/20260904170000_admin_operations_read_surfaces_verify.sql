-- Verification for 20260904170000_admin_operations_read_surfaces.

-- Every new policy reads, and none of them writes.
DO $$
DECLARE
  policy record;
BEGIN
  FOR policy IN
    SELECT polname, polrelid::regclass::text AS table_name, polcmd
      FROM pg_policy
     WHERE polname IN (
             'admin_usage_read',
             'ocade_organization_events_admin_platform_read',
             'ocade_organizations_admin_platform_read')
  LOOP
    -- 'r' is SELECT. Anything else would let an operator change what they are
    -- only meant to be looking at.
    IF policy.polcmd <> 'r' THEN
      RAISE EXCEPTION '% on % is not a read-only policy (%)',
        policy.polname, policy.table_name, policy.polcmd;
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM pg_policy WHERE polname = 'admin_usage_read') = 0 THEN
    RAISE EXCEPTION 'an operator cannot read commercial usage windows';
  END IF;
  IF (SELECT count(*) FROM pg_policy
       WHERE polname = 'ocade_organization_events_admin_platform_read') = 0 THEN
    RAISE EXCEPTION 'an operator cannot read the organization audit log';
  END IF;
END $$;

-- No admin policy was added to the notifications table. The aggregate exists
-- precisely so nobody has to read titles and bodies to answer an operational
-- question, and a policy here would undo that.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policy
     WHERE polrelid = 'public.ocade_notifications'::regclass
       AND pg_get_expr(polqual, polrelid) LIKE '%has_role%'
  ) THEN
    RAISE EXCEPTION 'an administrator can read every notification body in the deployment';
  END IF;
END $$;

-- The aggregate exists, checks the role itself, and is reachable by a browser.
DO $$
DECLARE
  body text;
BEGIN
  IF to_regprocedure('public.ocade_admin_notification_delivery(timestamptz)') IS NULL THEN
    RAISE EXCEPTION 'the notification delivery aggregate is missing';
  END IF;
  SELECT prosrc INTO body FROM pg_proc
   WHERE oid = to_regprocedure('public.ocade_admin_notification_delivery(timestamptz)');
  IF body NOT LIKE '%has_role%' THEN
    RAISE EXCEPTION 'the delivery aggregate does not check the caller''s role';
  END IF;
  IF body LIKE '%n.title%' OR body LIKE '%n.body%' THEN
    RAISE EXCEPTION 'the delivery aggregate returns notification content';
  END IF;
  IF NOT has_function_privilege(
       'authenticated', 'public.ocade_admin_notification_delivery(timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'an administrator cannot call the delivery aggregate';
  END IF;
  IF has_function_privilege(
       'anon', 'public.ocade_admin_notification_delivery(timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can call the delivery aggregate';
  END IF;
END $$;

-- Nothing here touched the payment tables. §G's billing and payment-event
-- surfaces are held with the payments work, because the deployment carries two
-- subscription tables and a screen that picked one would assert an answer to
-- the question that work exists to settle.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policy
     WHERE polrelid IN ('public.ocade_payment_events'::regclass, 'public.ocade_invoices'::regclass)
       AND pg_get_expr(polqual, polrelid) LIKE '%has_role%'
  ) THEN
    RAISE EXCEPTION 'an admin read reached the payment ledger ahead of the payments work';
  END IF;
END $$;
