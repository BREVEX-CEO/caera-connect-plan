-- Restore the column's shape. It cannot restore its contents.
--
-- Every timestamp the original column held was discarded when it was dropped,
-- and no other record of them exists. This brings back a nullable column in
-- which every row reads null, which is indistinguishable from "no demo was
-- ever recorded" — the correct reading now that there is no demo.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS demo_consumed_at timestamptz;

COMMENT ON COLUMN public.profiles.demo_consumed_at IS
  'Retired. The demo was removed from the product; this column has no reader and every row is null.';

COMMIT;
