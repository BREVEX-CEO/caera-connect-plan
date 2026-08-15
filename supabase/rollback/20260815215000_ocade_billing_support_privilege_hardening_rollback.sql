-- The preceding billing migration already declares these same intended ACLs.
-- Rolling back this hosted-DDL hardening must never reintroduce broad billing
-- writes, so the safe rollback reasserts the baseline privileges.

BEGIN;

REVOKE ALL ON TABLE
  public.ocade_payment_events,
  public.ocade_invoices,
  public.ocade_support_tickets,
  public.ocade_support_messages
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.ocade_payment_events, public.ocade_invoices
TO authenticated;
GRANT SELECT, INSERT ON TABLE public.ocade_support_tickets, public.ocade_support_messages
TO authenticated;
GRANT ALL ON TABLE
  public.ocade_payment_events,
  public.ocade_invoices,
  public.ocade_support_tickets,
  public.ocade_support_messages
TO service_role;

COMMIT;
