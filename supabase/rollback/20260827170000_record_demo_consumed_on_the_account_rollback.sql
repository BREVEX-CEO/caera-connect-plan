-- Remove the demo record from the account.
--
-- Destructive in one specific way: dropping the column discards which accounts
-- had already consumed a demo, and that cannot be recovered from the browsers
-- it was collected from. Export it first if the answer still matters.

BEGIN;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS demo_consumed_at;

COMMIT;
