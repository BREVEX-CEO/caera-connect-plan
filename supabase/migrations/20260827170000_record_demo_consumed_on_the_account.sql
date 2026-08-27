-- Remember on the ACCOUNT that this person already had their demo.
--
-- The 28-minute demo and its 28-hour reset window are enforced in the
-- browser, which is the only place an anonymous visitor exists. That is
-- honest but erasable: clearing site data, or a different profile, starts a
-- new one. Deliberately not defended with fingerprinting — identifying an
-- anonymous person across profiles is exactly the thing this product refuses
-- to do, and it does not work reliably anyway.
--
-- What CAN be recorded truthfully is the moment the visitor stops being
-- anonymous. When an account is created from a browser that has consumed a
-- demo, the account carries that fact from then on, on every device they sign
-- in from. It is a fact about the account, not a claim about the person.
--
-- Nullable, because most accounts will never have used a demo, and a null
-- means "no demo recorded" rather than "no demo happened".

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS demo_consumed_at timestamptz;

COMMENT ON COLUMN public.profiles.demo_consumed_at IS
  'When a demo session was consumed by the browser this account was created from. Null means none was recorded. Account-scoped: it says nothing about other devices or other accounts.';

COMMIT;
