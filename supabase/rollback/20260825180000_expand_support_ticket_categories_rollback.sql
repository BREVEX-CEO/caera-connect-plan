-- Narrow the support ticket category constraint back to the original set.
-- Rows already stored under the newer categories would violate the restored
-- constraint, so they are re-routed to 'account' first rather than blocking the
-- rollback half-way through.

BEGIN;

ALTER TABLE public.ocade_support_tickets
  DROP CONSTRAINT IF EXISTS ocade_support_tickets_category_check;

UPDATE public.ocade_support_tickets
SET category = 'account'
WHERE category IN ('legal', 'investor', 'partnership');

ALTER TABLE public.ocade_support_tickets
  ADD CONSTRAINT ocade_support_tickets_category_check
  CHECK (category IN ('account', 'billing', 'technical', 'privacy', 'security', 'feedback'));

COMMIT;
