-- Prove the four tables exist, use RLS, reject anon and keep billing writes server-only.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'ocade_payment_events', 'ocade_invoices', 'ocade_support_tickets', 'ocade_support_messages'
  ] LOOP
    IF to_regclass('public.' || table_name) IS NULL THEN
      RAISE EXCEPTION 'Missing table: %', table_name;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = table_name AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'RLS is not enabled on %', table_name;
    END IF;
  END LOOP;

  IF has_table_privilege('anon', 'public.ocade_payment_events', 'SELECT')
    OR has_table_privilege('anon', 'public.ocade_invoices', 'SELECT')
    OR has_table_privilege('anon', 'public.ocade_support_tickets', 'SELECT')
    OR has_table_privilege('anon', 'public.ocade_support_messages', 'SELECT') THEN
    RAISE EXCEPTION 'anon unexpectedly has billing or support table access';
  END IF;

  IF has_table_privilege('authenticated', 'public.ocade_payment_events', 'INSERT')
    OR has_table_privilege('authenticated', 'public.ocade_invoices', 'INSERT') THEN
    RAISE EXCEPTION 'authenticated users can write server-owned billing evidence';
  END IF;
END $$;

SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('ocade_payment_events', 'ocade_invoices', 'ocade_support_tickets', 'ocade_support_messages')
ORDER BY tablename;
