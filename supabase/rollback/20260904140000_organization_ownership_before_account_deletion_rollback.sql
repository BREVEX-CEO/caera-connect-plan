-- Rollback for 20260904140000_organization_ownership_before_account_deletion.
--
-- Restores the previous shape. Note what that MEANS, because a rollback run
-- during an incident is not the moment to work it out: it puts back
-- `created_by NOT NULL ... ON DELETE RESTRICT`, which fails account deletion at
-- its very last step, and it removes the trigger that stops a cascade from
-- leaving an organization with no owner.
--
-- The NOT NULL cannot be restored if any row has since had `created_by` set to
-- NULL by a deleted account, so it is attempted and reported rather than
-- assumed: failing loudly here is better than a constraint that silently was
-- not put back.

BEGIN;

DROP TRIGGER IF EXISTS ocade_organization_members_keep_an_owner
  ON public.ocade_organization_members;
DROP FUNCTION IF EXISTS public.ocade_organization_keeps_an_owner();
DROP FUNCTION IF EXISTS public.ocade_my_organizations_blocking_deletion();
DROP FUNCTION IF EXISTS public.ocade_organizations_blocking_deletion(uuid);

ALTER TABLE public.ocade_organizations
  DROP CONSTRAINT IF EXISTS ocade_organizations_created_by_fkey;
ALTER TABLE public.ocade_organizations
  ADD CONSTRAINT ocade_organizations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.ocade_organizations WHERE created_by IS NULL) THEN
    RAISE NOTICE
      'created_by left nullable: % row(s) have no creator, because their creator was deleted.',
      (SELECT count(*) FROM public.ocade_organizations WHERE created_by IS NULL);
  ELSE
    ALTER TABLE public.ocade_organizations ALTER COLUMN created_by SET NOT NULL;
  END IF;
END $$;

COMMIT;
