-- Restore the pre-atomic webhook surface. The route must be rolled back with
-- this migration because it calls the function removed here.
begin;

drop function if exists public.apply_payment_webhook_event(
  text, text, timestamptz, text, text, text, text, uuid, text, text, text,
  text, text, timestamptz, timestamptz, boolean, text, boolean
);

commit;
