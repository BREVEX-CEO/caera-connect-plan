-- Rollback for 20260904120000_ocade_organizations_and_membership.
--
-- Drops in dependency order and drops the FUNCTIONS TOO. A rollback that
-- removes the tables and leaves the functions behind leaves a schema where
-- `ocade_org_role` compiles and fails at call time, which is worse than either
-- state — and that is the exact defect the twin found in eleven of this
-- repository's earlier rollback scripts.
--
-- This is destructive: every organization, membership, invitation, group and
-- audit row goes with it. It exists to undo a bad deploy of THIS migration, not
-- to remove the feature from a database people are using.

BEGIN;

DROP FUNCTION IF EXISTS public.ocade_delete_organization(uuid, text);
DROP FUNCTION IF EXISTS public.ocade_rename_organization(uuid, text);
DROP FUNCTION IF EXISTS public.ocade_set_organization_group_membership(uuid, uuid, boolean);
DROP FUNCTION IF EXISTS public.ocade_delete_organization_group(uuid);
DROP FUNCTION IF EXISTS public.ocade_create_organization_group(uuid, text);
DROP FUNCTION IF EXISTS public.ocade_transfer_organization_ownership(uuid, uuid);
DROP FUNCTION IF EXISTS public.ocade_remove_organization_member(uuid);
DROP FUNCTION IF EXISTS public.ocade_set_organization_member_state(uuid, text);
DROP FUNCTION IF EXISTS public.ocade_set_organization_member_role(uuid, text);
DROP FUNCTION IF EXISTS public.ocade_org_active_owners(uuid, uuid);
DROP FUNCTION IF EXISTS public.ocade_resend_organization_invite(uuid, text, timestamptz);
DROP FUNCTION IF EXISTS public.ocade_revoke_organization_invite(uuid);
DROP FUNCTION IF EXISTS public.ocade_accept_organization_invite(text);
DROP FUNCTION IF EXISTS public.ocade_invite_to_organization(uuid, text, text, text, timestamptz);
DROP FUNCTION IF EXISTS public.ocade_create_organization(text, text);
DROP FUNCTION IF EXISTS public.ocade_record_organization_event(uuid, text, uuid, jsonb);

-- The tables cascade to their own policies, indexes and child rows. The
-- helpers go LAST because the policies being dropped with the tables reference
-- them, and a function still referenced by a policy cannot be dropped.
DROP TABLE IF EXISTS public.ocade_organization_group_members;
DROP TABLE IF EXISTS public.ocade_organization_groups;
DROP TABLE IF EXISTS public.ocade_organization_events;
DROP TABLE IF EXISTS public.ocade_organization_invites;
DROP TABLE IF EXISTS public.ocade_organization_members;
DROP TABLE IF EXISTS public.ocade_organizations;

DROP FUNCTION IF EXISTS public.ocade_org_is_owner(uuid);
DROP FUNCTION IF EXISTS public.ocade_org_can_administer(uuid);
DROP FUNCTION IF EXISTS public.ocade_org_role(uuid);

COMMIT;
