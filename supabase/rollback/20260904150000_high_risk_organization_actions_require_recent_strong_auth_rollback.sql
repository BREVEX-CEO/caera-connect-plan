-- Rollback for 20260904150000_high_risk_organization_actions_require_recent_strong_auth.
--
-- WHAT THIS PUTS BACK, said plainly because a rollback run during an incident
-- is not the moment to work it out: after this, deleting an organization,
-- handing it to somebody else, changing what a member may do and removing a
-- member all succeed on any signed-in session of an authorized administrator,
-- however long ago that session last proved who it was, and whether or not the
-- account holds a second factor. That is the state the product was in before
-- this migration, and it is the reason the migration exists.
--
-- Use it only if the check is refusing somebody who should be allowed through
-- — a deployment whose tokens carry no authentication-methods list would do
-- that, and would refuse everyone — and put it back once the tokens are right.

BEGIN;

CREATE OR REPLACE FUNCTION public.ocade_delete_organization(
  p_organization_id uuid,
  p_typed_name text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.ocade_organizations;
BEGIN
  SELECT * INTO target FROM public.ocade_organizations WHERE id = p_organization_id FOR UPDATE;
  IF target.id IS NULL THEN RETURN 0; END IF;
  IF NOT public.ocade_org_is_owner(p_organization_id) THEN
    RAISE EXCEPTION 'Only an owner may delete this organization.';
  END IF;
  IF p_typed_name IS DISTINCT FROM target.name THEN
    RAISE EXCEPTION 'Type the organization name exactly to confirm.';
  END IF;

  DELETE FROM public.ocade_organizations WHERE id = p_organization_id;
  RETURN 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_transfer_organization_ownership(
  p_organization_id uuid,
  p_to_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient public.ocade_organization_members;
BEGIN
  IF NOT public.ocade_org_is_owner(p_organization_id) THEN
    RAISE EXCEPTION 'Only an owner may transfer ownership.';
  END IF;
  IF p_to_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You already own this organization.';
  END IF;

  SELECT * INTO recipient
    FROM public.ocade_organization_members
   WHERE organization_id = p_organization_id AND user_id = p_to_user_id
   FOR UPDATE;
  IF recipient.id IS NULL THEN
    RAISE EXCEPTION 'That person is not in this organization.';
  END IF;
  IF recipient.state <> 'active' THEN
    RAISE EXCEPTION 'A deactivated member cannot become the owner.';
  END IF;

  UPDATE public.ocade_organization_members
     SET role = 'owner', updated_at = now()
   WHERE id = recipient.id;

  UPDATE public.ocade_organization_members
     SET role = 'admin', updated_at = now()
   WHERE organization_id = p_organization_id AND user_id = auth.uid();

  PERFORM public.ocade_record_organization_event(
    p_organization_id, 'ownership.transferred', p_to_user_id,
    jsonb_build_object('from', auth.uid())
  );

  RETURN 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_set_organization_member_role(
  p_member_id uuid,
  p_role text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.ocade_organization_members;
  caller_role text;
BEGIN
  SELECT * INTO target FROM public.ocade_organization_members WHERE id = p_member_id FOR UPDATE;
  IF target.id IS NULL THEN RAISE EXCEPTION 'That person is not in this organization.'; END IF;

  caller_role := public.ocade_org_role(target.organization_id);
  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only an owner or admin may change a role.';
  END IF;
  -- Only an owner may create or unmake an owner.
  IF (p_role = 'owner' OR target.role = 'owner') AND caller_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner may change an owner''s role.';
  END IF;
  IF target.role = 'owner' AND p_role <> 'owner'
     AND public.ocade_org_active_owners(target.organization_id, target.id) = 0 THEN
    RAISE EXCEPTION 'This is the last owner. Make somebody else an owner first.';
  END IF;

  IF target.role = p_role THEN RETURN 0; END IF;

  UPDATE public.ocade_organization_members
     SET role = p_role, updated_at = now()
   WHERE id = p_member_id;

  PERFORM public.ocade_record_organization_event(
    target.organization_id, 'member.role_changed', target.user_id,
    jsonb_build_object('from', target.role, 'to', p_role)
  );
  RETURN 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_remove_organization_member(p_member_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.ocade_organization_members;
BEGIN
  SELECT * INTO target FROM public.ocade_organization_members WHERE id = p_member_id FOR UPDATE;
  IF target.id IS NULL THEN RETURN 0; END IF;
  IF NOT public.ocade_org_can_administer(target.organization_id) THEN
    RAISE EXCEPTION 'Only an owner or admin may remove a member.';
  END IF;
  IF target.role = 'owner' AND NOT public.ocade_org_is_owner(target.organization_id) THEN
    RAISE EXCEPTION 'Only an owner may remove an owner.';
  END IF;
  IF target.role = 'owner'
     AND public.ocade_org_active_owners(target.organization_id, target.id) = 0 THEN
    RAISE EXCEPTION 'This is the last owner. Transfer ownership first.';
  END IF;

  DELETE FROM public.ocade_organization_members WHERE id = p_member_id;

  PERFORM public.ocade_record_organization_event(
    target.organization_id, 'member.removed', target.user_id,
    jsonb_build_object('role', target.role)
  );
  RETURN 1;
END;
$$;

DROP FUNCTION IF EXISTS public.ocade_require_recent_strong_auth(text);
DROP FUNCTION IF EXISTS public.ocade_session_last_proof_at();
DROP FUNCTION IF EXISTS public.ocade_session_has_verified_factor();
DROP FUNCTION IF EXISTS public.ocade_recent_proof_window();

COMMIT;
