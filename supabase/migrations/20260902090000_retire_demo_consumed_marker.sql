-- Retire the account-level demo marker, because the demo is gone.
--
-- `profiles.demo_consumed_at` recorded that the browser an account was created
-- from had already used the 28-minute anonymous demo, so a second one could not
-- be started. The demo has been removed from the product entirely — its routes,
-- its session clock, its reset window and its entitlement rule — and Free is now
-- a real authenticated account plan rather than a timed trial.
--
-- The column therefore has no reader and, more importantly, no MEANING: it
-- answers a question ("has this account had its demo?") that the product can no
-- longer ask and must never answer. Keeping it would leave a demo entitlement
-- record on every account that had one, which is precisely what removing the
-- demo is supposed to end.
--
-- DESTRUCTIVE, AND DELIBERATELY SO. Dropping the column discards the timestamps
-- it holds. They cannot be reconstructed — the browsers that produced them keep
-- nothing that survived the demo's removal — and there is nothing left that
-- would consume them. The rollback recreates the column but cannot recreate the
-- values; it exists to restore the SHAPE, not the history.

BEGIN;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS demo_consumed_at;

COMMIT;
