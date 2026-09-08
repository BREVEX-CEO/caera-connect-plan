-- Narrow the plan constraints back to the retired catalogue, and drop the
-- catalogue stamp.
--
-- DESTRUCTIVE IF THE CURRENT CATALOGUE HAS BEEN SOLD. Narrowing the CHECK back
-- fails outright while any row names a current plan, which is the correct
-- outcome: silently deleting a live subscription to satisfy a constraint would
-- be far worse than refusing to roll back. Remove or re-plan those rows first
-- if this rollback is genuinely intended.

BEGIN;

ALTER TABLE public.ocade_subscriptions DROP COLUMN IF EXISTS catalogue_version;
ALTER TABLE public.ocade_payment_events DROP COLUMN IF EXISTS catalogue_version;
ALTER TABLE public.ocade_invoices DROP COLUMN IF EXISTS catalogue_version;

ALTER TABLE public.ocade_subscriptions
  DROP CONSTRAINT IF EXISTS ocade_subscriptions_plan_id_check;
ALTER TABLE public.ocade_subscriptions
  ADD CONSTRAINT ocade_subscriptions_plan_id_check
  CHECK (plan_id IN ('trial_2d', 'std_8d', 'month_1m', 'year_1y'));

ALTER TABLE public.ocade_payment_events
  DROP CONSTRAINT IF EXISTS ocade_payment_events_plan_id_check;
ALTER TABLE public.ocade_payment_events
  ADD CONSTRAINT ocade_payment_events_plan_id_check
  CHECK (plan_id IN ('trial_2d', 'std_8d', 'month_1m', 'year_1y'));

ALTER TABLE public.ocade_invoices
  DROP CONSTRAINT IF EXISTS ocade_invoices_plan_id_check;
ALTER TABLE public.ocade_invoices
  ADD CONSTRAINT ocade_invoices_plan_id_check
  CHECK (plan_id IN ('trial_2d', 'std_8d', 'month_1m', 'year_1y'));

COMMIT;
