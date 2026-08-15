-- Prove hosted DDL defaults cannot restore direct browser-role billing writes.
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.ocade_payment_events', 'SELECT')
    OR has_table_privilege('anon', 'public.ocade_invoices', 'SELECT')
    OR has_table_privilege('anon', 'public.ocade_support_tickets', 'SELECT')
    OR has_table_privilege('anon', 'public.ocade_support_messages', 'SELECT') THEN
    RAISE EXCEPTION 'anon unexpectedly has billing or support table access';
  END IF;

  IF has_table_privilege('authenticated', 'public.ocade_payment_events', 'INSERT')
    OR has_table_privilege('authenticated', 'public.ocade_payment_events', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.ocade_payment_events', 'DELETE')
    OR has_table_privilege('authenticated', 'public.ocade_payment_events', 'TRUNCATE')
    OR has_table_privilege('authenticated', 'public.ocade_invoices', 'INSERT')
    OR has_table_privilege('authenticated', 'public.ocade_invoices', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.ocade_invoices', 'DELETE')
    OR has_table_privilege('authenticated', 'public.ocade_invoices', 'TRUNCATE') THEN
    RAISE EXCEPTION 'authenticated users can mutate server-owned billing evidence';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.ocade_payment_events', 'SELECT')
    OR NOT has_table_privilege('authenticated', 'public.ocade_invoices', 'SELECT')
    OR NOT has_table_privilege('authenticated', 'public.ocade_support_tickets', 'SELECT')
    OR NOT has_table_privilege('authenticated', 'public.ocade_support_tickets', 'INSERT')
    OR NOT has_table_privilege('authenticated', 'public.ocade_support_messages', 'SELECT')
    OR NOT has_table_privilege('authenticated', 'public.ocade_support_messages', 'INSERT') THEN
    RAISE EXCEPTION 'required customer billing or support access is missing';
  END IF;
END $$;

SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
  AND table_name IN (
    'ocade_payment_events', 'ocade_invoices',
    'ocade_support_tickets', 'ocade_support_messages'
  )
ORDER BY table_name, grantee, privilege_type;
