-- The Free / Pro / Max catalogue, and the record of which catalogue a row was
-- written under.
--
-- WHAT CHANGED. OCADE sold `trial_2d`, `std_8d`, `month_1m` and `year_1y` — two
-- fixed-length passes and two renewing licences, one of them a one-time
-- purchase. The product now sells Free (a real account plan, not a trial) and
-- Pro and Max on weekly and monthly cadences. The `plan_id` CHECK constraints
-- still named only the retired ids, so a Pro subscription could not be written
-- at all: the database would have rejected the first genuine purchase.
--
-- WHY THE RETIRED IDS STAY VALID. A payment record naming `std_8d` is a
-- financial fact. A database that rejects its own history cannot store it, and
-- an invoice that cannot be written is an invoice that cannot be shown to the
-- customer it belongs to. So the constraints accept both sets: the current
-- catalogue for new rows, the archived one for old rows. Nothing in the product
-- prices, sells, or resolves an entitlement from an archived id — that is
-- enforced in the catalogue module, where it belongs, rather than by making the
-- database unable to hold the past.
--
-- WHY A CATALOGUE VERSION. Prices change. Without a stamp, a later change
-- retroactively reinterprets what somebody already bought, and a provider event
-- naming a price OCADE no longer recognises has to be guessed at rather than
-- rejected. The column records which catalogue was in force when the row was
-- written, so both questions have an answer that does not depend on today's
-- price list.
--
-- Backfilled to 'legacy' rather than to the current version: rows written
-- before this migration were NOT written under the current catalogue, and
-- claiming they were would be the exact falsehood the column exists to prevent.

BEGIN;

-- The two id sets, as one list per table. Written out rather than shared
-- through a domain so that each table's constraint is readable on its own and
-- a future table cannot silently inherit a widened set.
ALTER TABLE public.ocade_subscriptions
  DROP CONSTRAINT IF EXISTS ocade_subscriptions_plan_id_check;
ALTER TABLE public.ocade_subscriptions
  ADD CONSTRAINT ocade_subscriptions_plan_id_check CHECK (
    plan_id IN (
      -- Current catalogue.
      'free', 'pro_weekly', 'pro_monthly', 'max_weekly', 'max_monthly',
      -- Archived: readable history, never sold.
      'demo', 'trial_2d', 'std_8d', 'month_1m', 'year_1y'
    )
  );

ALTER TABLE public.ocade_payment_events
  DROP CONSTRAINT IF EXISTS ocade_payment_events_plan_id_check;
ALTER TABLE public.ocade_payment_events
  ADD CONSTRAINT ocade_payment_events_plan_id_check CHECK (
    plan_id IN (
      'free', 'pro_weekly', 'pro_monthly', 'max_weekly', 'max_monthly',
      'demo', 'trial_2d', 'std_8d', 'month_1m', 'year_1y'
    )
  );

ALTER TABLE public.ocade_invoices
  DROP CONSTRAINT IF EXISTS ocade_invoices_plan_id_check;
ALTER TABLE public.ocade_invoices
  ADD CONSTRAINT ocade_invoices_plan_id_check CHECK (
    plan_id IN (
      'free', 'pro_weekly', 'pro_monthly', 'max_weekly', 'max_monthly',
      'demo', 'trial_2d', 'std_8d', 'month_1m', 'year_1y'
    )
  );

-- Which catalogue the row was written under.
ALTER TABLE public.ocade_subscriptions
  ADD COLUMN IF NOT EXISTS catalogue_version text NOT NULL DEFAULT 'legacy';
ALTER TABLE public.ocade_payment_events
  ADD COLUMN IF NOT EXISTS catalogue_version text NOT NULL DEFAULT 'legacy';
ALTER TABLE public.ocade_invoices
  ADD COLUMN IF NOT EXISTS catalogue_version text NOT NULL DEFAULT 'legacy';

COMMENT ON COLUMN public.ocade_subscriptions.catalogue_version IS
  'Which price catalogue was in force when this row was written. ''legacy'' means it predates versioning.';
COMMENT ON COLUMN public.ocade_payment_events.catalogue_version IS
  'Which price catalogue was in force when this event was applied. ''legacy'' means it predates versioning.';
COMMENT ON COLUMN public.ocade_invoices.catalogue_version IS
  'Which price catalogue this invoice was priced under. ''legacy'' means it predates versioning.';

COMMIT;
