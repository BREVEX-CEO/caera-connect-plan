-- The capability a workspace may withhold is called `accountStorage`.
--
-- `ocade_organization_policies` constrains `withheld_capabilities` to the
-- product's own capability vocabulary, and refuses an unknown string on the way
-- in — a policy that appears to forbid something it does not is worse than no
-- policy, because somebody is relying on it. That only works while the two
-- vocabularies agree.
--
-- `PLAN.md` Phase 2 removed the per-device storage modes and renamed the
-- capability from `privateSync` to `accountStorage`, because there is no
-- "private sync" any more: work is kept in the account, and the capability
-- reports whether that account is reachable. The constraint kept the old name,
-- so an administrator withholding account storage would have been refused by
-- the database with nothing on screen explaining why.
--
-- SAFE ON EXISTING ROWS. Any stored `privateSync` is rewritten before the
-- constraint changes, so a workspace that had withheld it keeps withholding it
-- rather than silently regaining it.

BEGIN;

ALTER TABLE public.ocade_organization_policies
  DROP CONSTRAINT IF EXISTS ocade_organization_policies_capabilities;

UPDATE public.ocade_organization_policies
   SET withheld_capabilities =
         array_replace(withheld_capabilities, 'privateSync', 'accountStorage')
 WHERE 'privateSync' = ANY (withheld_capabilities);

ALTER TABLE public.ocade_organization_policies
  ADD CONSTRAINT ocade_organization_policies_capabilities CHECK (
    withheld_capabilities <@ ARRAY[
      'localAI', 'accountStorage', 'browser', 'computerControl', 'codeTerminal',
      'voice', 'vision', 'automationRunner', 'monitors', 'payments',
      'desktopInstaller'
    ]::text[]
  );

COMMIT;
