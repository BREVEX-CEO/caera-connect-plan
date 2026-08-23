-- Rollback for the payment webhook audit trail.
--
-- READ THIS BEFORE RUNNING IT. Dropping these returns the webhook to a state
-- with no replay protection, no event ordering and no record that a payment
-- event was ever received. The application code REQUIRES them: the handler
-- claims an audit row before applying anything, so with the table gone every
-- delivery fails and the provider retries for days.
--
-- Roll this back only together with reverting the webhook handler, and only
-- after exporting payment_webhook_events — it is the only evidence OCADE holds
-- of what a provider told it, which is exactly what a dispute is argued from.

BEGIN;

DROP TABLE IF EXISTS public.payment_webhook_events;

ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS provider_event_at;
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS kind;

COMMIT;
