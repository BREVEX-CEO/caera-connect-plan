-- Ownership safety at the moment an account is deleted, as PLAN.md §O requires.
--
-- WHAT WAS WRONG, AND WHY IT WAS WORSE THAN IT LOOKED.
--
-- `20260904120000` gave OCADE an organization model, and account deletion knew
-- nothing about it. Two things followed, both bad, and neither visible until
-- somebody actually deleted an account that had a team:
--
--   1. `ocade_organizations.created_by` was NOT NULL REFERENCES auth.users
--      ON DELETE RESTRICT. That was written to make the database refuse an
--      unsafe order — but it refuses at `auth.admin.deleteUser`, which the
--      deletion path runs LAST, after every profile, device, conversation and
--      ticket has already been destroyed. The person would be told "Account
--      records were removed but sign-in deletion failed" and left with a gutted
--      account they could still sign into. Provenance is not authority: an
--      account that handed its workspace to somebody else and left should be
--      deletable, and it was not.
--
--   2. `ocade_organization_members.user_id` is ON DELETE CASCADE, so deleting
--      the identity SILENTLY removes their membership. If they were the last
--      active owner, the organization is left with nobody who can administer
--      it — the exact state the whole schema exists to prevent, reached by the
--      one path that never called any of the functions that prevent it.
--
-- THE FIX IS BOTH HALVES. Provenance stops trapping the account, and the
-- invariant moves into a trigger so it holds no matter which path removes the
-- row — including a cascade nobody wrote and nobody can see at the call site.
--
-- §O asks for "transfer organization ownership before owner deletion" and
-- "prevent deletion of the last organization owner". Those are the same rule
-- read from two ends, and this is where it is enforced.

BEGIN;

/*
 * `created_by` becomes nullable, and the reference becomes SET NULL.
 *
 * It records who started the organization, which stays useful and stops being
 * a reason the database refuses to let somebody leave. The organization's
 * SAFETY comes from having an active owner, which the trigger below guarantees
 * and this column never did.
 */
ALTER TABLE public.ocade_organizations
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.ocade_organizations
  DROP CONSTRAINT IF EXISTS ocade_organizations_created_by_fkey;

ALTER TABLE public.ocade_organizations
  ADD CONSTRAINT ocade_organizations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

/**
 * Refuse to leave an organization with no active owner.
 *
 * WHY A TRIGGER AND NOT ANOTHER CHECK IN THE FUNCTIONS. The functions already
 * check, and they are not the problem: the problem is the path that calls no
 * function at all. `ON DELETE CASCADE` from `auth.users` removes a membership
 * row with no OCADE code involved anywhere, and an application-level rule
 * cannot see it happen. A trigger is the only place that runs on every path.
 *
 * THE ORGANIZATION BEING DELETED IS NOT A VIOLATION. When
 * `ocade_delete_organization` removes the organization, PostgreSQL deletes the
 * parent row and then cascades to its members — so by the time this fires the
 * organization is already gone, and an organization that does not exist cannot
 * be left without an owner. Checking for the parent is what distinguishes
 * "this workspace is being dismantled" from "its last owner is walking away".
 */
CREATE OR REPLACE FUNCTION public.ocade_organization_keeps_an_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.ocade_organizations WHERE id = OLD.organization_id
  ) THEN
    RETURN OLD;
  END IF;

  IF OLD.role <> 'owner' OR OLD.state <> 'active' THEN
    RETURN OLD;
  END IF;

  SELECT count(*) INTO remaining
    FROM public.ocade_organization_members
   WHERE organization_id = OLD.organization_id
     AND role = 'owner'
     AND state = 'active'
     AND id <> OLD.id;

  IF remaining = 0 THEN
    RAISE EXCEPTION
      'This account is the last owner of an organization. Transfer ownership or delete the organization first.'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS ocade_organization_members_keep_an_owner
  ON public.ocade_organization_members;
CREATE TRIGGER ocade_organization_members_keep_an_owner
  BEFORE DELETE ON public.ocade_organization_members
  FOR EACH ROW EXECUTE FUNCTION public.ocade_organization_keeps_an_owner();

/**
 * The organizations this account cannot walk away from, and why.
 *
 * The deletion path calls this BEFORE it destroys anything, so somebody is told
 * what to do while they still have an account to do it with. The trigger above
 * is the backstop; this is the sentence a person reads.
 *
 * `solo` separates the two answers, because they need different actions:
 * an organization with other people in it needs ownership TRANSFERRED, and one
 * with nobody else in it can only be DELETED — telling somebody to transfer
 * ownership to nobody is advice they cannot follow.
 */
CREATE OR REPLACE FUNCTION public.ocade_organizations_blocking_deletion(p_user_id uuid)
RETURNS TABLE (organization_id uuid, name text, solo boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id,
         o.name,
         NOT EXISTS (
           SELECT 1
             FROM public.ocade_organization_members other
            WHERE other.organization_id = o.id
              AND other.user_id <> p_user_id
              AND other.state = 'active'
         ) AS solo
    FROM public.ocade_organizations o
    JOIN public.ocade_organization_members m
      ON m.organization_id = o.id
     AND m.user_id = p_user_id
     AND m.role = 'owner'
     AND m.state = 'active'
   WHERE (
     SELECT count(*)
       FROM public.ocade_organization_members owners
      WHERE owners.organization_id = o.id
        AND owners.role = 'owner'
        AND owners.state = 'active'
   ) = 1
   ORDER BY o.name
$$;

REVOKE ALL ON FUNCTION public.ocade_organization_keeps_an_owner()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_organizations_blocking_deletion(uuid)
  FROM PUBLIC, anon, authenticated;
/*
 * Readable by the account it is about, so the Delete-account screen can warn
 * BEFORE the button is pressed rather than after. The parameter is checked
 * against `auth.uid()` by the wrapper below; this one takes an id because the
 * server calls it as the service role during deletion, when there is no JWT.
 */
GRANT EXECUTE ON FUNCTION public.ocade_organizations_blocking_deletion(uuid) TO service_role;

/** The same question, asked about the caller and nobody else. */
CREATE OR REPLACE FUNCTION public.ocade_my_organizations_blocking_deletion()
RETURNS TABLE (organization_id uuid, name text, solo boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.ocade_organizations_blocking_deletion(auth.uid())
$$;

REVOKE ALL ON FUNCTION public.ocade_my_organizations_blocking_deletion()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_my_organizations_blocking_deletion() TO authenticated;

COMMIT;
