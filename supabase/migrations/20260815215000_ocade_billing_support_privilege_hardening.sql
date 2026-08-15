-- Reassert least-privilege table ACLs after hosted DDL hooks have finished.
-- Some managed Supabase/Lovable environments grant broad authenticated
-- privileges when a table is created. RLS remains mandatory, but server-owned
-- billing evidence must also reject direct writes at the privilege layer.

BEGIN;

REVOKE ALL ON TABLE
  public.ocade_payment_events,
  public.ocade_invoices,
  public.ocade_support_tickets,
  public.ocade_support_messages
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
  public.ocade_payment_events,
  public.ocade_invoices
TO authenticated;

GRANT SELECT, INSERT ON TABLE
  public.ocade_support_tickets,
  public.ocade_support_messages
TO authenticated;

GRANT ALL ON TABLE
  public.ocade_payment_events,
  public.ocade_invoices,
  public.ocade_support_tickets,
  public.ocade_support_messages
TO service_role;

COMMIT;
