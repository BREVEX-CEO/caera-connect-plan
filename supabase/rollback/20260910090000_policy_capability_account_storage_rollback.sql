-- Reverses 20260910090000_policy_capability_account_storage.sql.
--
-- Puts the old `privateSync` name back, rewriting any stored value first so a
-- workspace that had withheld account storage keeps withholding it.

BEGIN;

ALTER TABLE public.ocade_organization_policies
  DROP CONSTRAINT IF EXISTS ocade_organization_policies_capabilities;

UPDATE public.ocade_organization_policies
   SET withheld_capabilities =
         array_replace(withheld_capabilities, 'accountStorage', 'privateSync')
 WHERE 'accountStorage' = ANY (withheld_capabilities);

ALTER TABLE public.ocade_organization_policies
  ADD CONSTRAINT ocade_organization_policies_capabilities CHECK (
    withheld_capabilities <@ ARRAY[
      'localAI', 'privateSync', 'browser', 'computerControl', 'codeTerminal',
      'voice', 'vision', 'automationRunner', 'monitors', 'payments',
      'desktopInstaller'
    ]::text[]
  );

COMMIT;
