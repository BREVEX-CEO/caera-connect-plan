-- Reverses 20260910130000_confirm_before_granting_workspace_access.sql.
--
-- Restores the three grant paths without the recent-strong-auth gate, exactly as
-- they were before. This leaves inviting an address, re-issuing its link and
-- reactivating a suspended member reachable from a session that proved nothing
-- recently, which is the state the migration exists to end.

BEGIN;


CREATE OR REPLACE FUNCTION public.ocade_invite_to_organization(
  p_organization_id uuid,
  p_email text,
  p_role text,
  p_token_hash text,
  p_expires_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  normalised text := lower(trim(p_email));
  invite_id uuid;
BEGIN
  IF NOT public.ocade_org_can_administer(p_organization_id) THEN
    RAISE EXCEPTION 'Only an owner or admin may invite people to this organization.';
  END IF;
  IF p_role = 'owner' AND NOT public.ocade_org_is_owner(p_organization_id) THEN
    RAISE EXCEPTION 'Only an owner may invite another owner.';
  END IF;
  IF p_expires_at <= now() THEN
    RAISE EXCEPTION 'An invitation must expire in the future.';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.ocade_organization_members m
      JOIN auth.users u ON u.id = m.user_id
     WHERE m.organization_id = p_organization_id AND lower(u.email) = normalised
  ) THEN
    RAISE EXCEPTION 'That person is already in this organization.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ocade_organization_invites
     WHERE organization_id = p_organization_id
       AND email = normalised
       AND accepted_at IS NULL
       AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'That address already has an open invitation. Resend it instead.';
  END IF;

  INSERT INTO public.ocade_organization_invites
    (organization_id, email, role, token_hash, invited_by, expires_at)
  VALUES
    (p_organization_id, normalised, p_role, p_token_hash, auth.uid(), p_expires_at)
  RETURNING id INTO invite_id;

  PERFORM public.ocade_record_organization_event(
    p_organization_id, 'invite.sent', NULL,
    jsonb_build_object('invite_id', invite_id, 'email', normalised, 'role', p_role)
  );

  RETURN invite_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ocade_resend_organization_invite(
  p_invite_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target public.ocade_organization_invites;
BEGIN
  SELECT * INTO target
    FROM public.ocade_organization_invites WHERE id = p_invite_id FOR UPDATE;
  IF target.id IS NULL THEN
    RAISE EXCEPTION 'That invitation no longer exists.';
  END IF;
  IF NOT public.ocade_org_can_administer(target.organization_id) THEN
    RAISE EXCEPTION 'Only an owner or admin may resend an invitation.';
  END IF;
  IF target.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'That invitation has already been accepted.';
  END IF;
  IF target.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'That invitation was withdrawn. Send a new one.';
  END IF;
  IF p_expires_at <= now() THEN
    RAISE EXCEPTION 'An invitation must expire in the future.';
  END IF;

  UPDATE public.ocade_organization_invites
     SET token_hash = p_token_hash, expires_at = p_expires_at
   WHERE id = p_invite_id;

  PERFORM public.ocade_record_organization_event(
    target.organization_id, 'invite.resent', NULL,
    jsonb_build_object('invite_id', p_invite_id, 'email', target.email)
  );
  RETURN 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ocade_set_organization_member_state(
  p_member_id uuid,
  p_state text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target public.ocade_organization_members;
BEGIN
  SELECT * INTO target FROM public.ocade_organization_members WHERE id = p_member_id FOR UPDATE;
  IF target.id IS NULL THEN RAISE EXCEPTION 'That person is not in this organization.'; END IF;
  IF NOT public.ocade_org_can_administer(target.organization_id) THEN
    RAISE EXCEPTION 'Only an owner or admin may deactivate a member.';
  END IF;
  IF target.role = 'owner' AND NOT public.ocade_org_is_owner(target.organization_id) THEN
    RAISE EXCEPTION 'Only an owner may deactivate an owner.';
  END IF;
  IF p_state = 'deactivated' AND target.role = 'owner'
     AND public.ocade_org_active_owners(target.organization_id, target.id) = 0 THEN
    RAISE EXCEPTION 'This is the last active owner.';
  END IF;

  IF target.state = p_state THEN RETURN 0; END IF;

  UPDATE public.ocade_organization_members
     SET state = p_state, updated_at = now()
   WHERE id = p_member_id;

  PERFORM public.ocade_record_organization_event(
    target.organization_id,
    CASE WHEN p_state = 'deactivated' THEN 'member.deactivated' ELSE 'member.reactivated' END,
    target.user_id,
    '{}'::jsonb
  );
  RETURN 1;
END;
$function$;

COMMIT;
