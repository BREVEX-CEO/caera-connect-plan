-- Verification for 20260904130000_revoke_default_privilege_writes.
--
-- Asserts the privilege layer directly, table by table, because that is the
-- half that three earlier verification scripts believed and could not see.

DO $$
DECLARE
  offenders text;
BEGIN
  SELECT string_agg(format('%s(%s)', t, priv), ', ')
    INTO offenders
    FROM (
      SELECT c.relname AS t, p.priv
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        CROSS JOIN unnest(ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) AS p(priv)
       WHERE n.nspname = 'public'
         AND c.relkind = 'r'
         AND c.relname IN (
           'ocade_organizations', 'ocade_organization_members',
           'ocade_organization_invites', 'ocade_organization_groups',
           'ocade_organization_group_members', 'ocade_organization_events',
           'ocade_payment_events', 'ocade_invoices'
         )
         AND has_table_privilege('authenticated', c.oid, p.priv)
    ) AS bad;
  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION 'authenticated can still write: %', offenders;
  END IF;
END $$;

-- Support rows are opened by the person asking for help, so INSERT is correct
-- there — but never UPDATE or DELETE, which would let a requester rewrite the
-- record of what they reported.
DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.ocade_support_tickets', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.ocade_support_tickets', 'DELETE')
     OR has_table_privilege('authenticated', 'public.ocade_support_messages', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.ocade_support_messages', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated can rewrite support history';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.ocade_support_tickets', 'INSERT') THEN
    RAISE EXCEPTION 'nobody can open a support ticket any more';
  END IF;
END $$;

-- A notification is a record of what somebody was told. It is readable and
-- nothing else; marking one read goes through a function.
DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.ocade_notifications', 'INSERT')
     OR has_table_privilege('authenticated', 'public.ocade_notifications', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.ocade_notifications', 'DELETE') THEN
    RAISE EXCEPTION 'a browser can write its own notification history';
  END IF;
END $$;

-- Consent receipts: recordable, readable, never editable.
DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.legal_consent_receipts', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.legal_consent_receipts', 'DELETE') THEN
    RAISE EXCEPTION 'consent receipts are still editable by the party they protect';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.legal_consent_receipts', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'public.legal_consent_receipts', 'SELECT') THEN
    RAISE EXCEPTION 'consent can no longer be recorded or read back';
  END IF;
END $$;

-- Reads must survive: a revoke that took SELECT with it would break every
-- screen, and "nobody can do anything" also satisfies "nobody can write".
DO $$
DECLARE
  unreadable text;
BEGIN
  SELECT string_agg(c.relname, ', ')
    INTO unreadable
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND c.relname LIKE 'ocade_organization%'
     AND NOT has_table_privilege('authenticated', c.oid, 'SELECT');
  IF unreadable IS NOT NULL THEN
    RAISE EXCEPTION 'authenticated can no longer read: %', unreadable;
  END IF;
END $$;

-- The audit writer is reachable only from the functions that call it.
DO $$
BEGIN
  IF has_function_privilege(
       'authenticated',
       'public.ocade_record_organization_event(uuid, text, uuid, jsonb)',
       'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated can forge organization history';
  END IF;
END $$;
