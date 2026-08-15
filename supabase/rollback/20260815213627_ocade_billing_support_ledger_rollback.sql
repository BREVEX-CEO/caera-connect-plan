-- Remove the prepared OCADE billing evidence and support workflow as one transaction.
BEGIN;
DROP FUNCTION IF EXISTS public.ocade_create_support_ticket(TEXT, TEXT, TEXT);
DROP TRIGGER IF EXISTS ocade_support_messages_touch ON public.ocade_support_messages;
DROP FUNCTION IF EXISTS public.ocade_support_touch_ticket();
DROP TABLE IF EXISTS public.ocade_support_messages;
DROP TABLE IF EXISTS public.ocade_support_tickets;
DROP TABLE IF EXISTS public.ocade_invoices;
DROP TABLE IF EXISTS public.ocade_payment_events;
DROP FUNCTION IF EXISTS public.ocade_is_support_admin();
COMMIT;
