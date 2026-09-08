-- Rollback for 20260904160000_organization_capability_and_tool_policies.
--
-- WHAT THIS PUTS BACK: no organization can withhold a capability or a tool area
-- from its members, and any policy already set is DESTROYED — the table goes,
-- and with it every administrator's decision about what their workspace allows.
-- Export `ocade_organization_policies` first if those decisions matter.
--
-- The audit rows survive. `policy.changed` is removed from the event
-- vocabulary, which is a CHECK on new rows only, so the history of what was
-- withheld and by whom stays readable.

BEGIN;

DROP FUNCTION IF EXISTS public.ocade_set_organization_policy(uuid, text[], text[]);
DROP TABLE IF EXISTS public.ocade_organization_policies;

ALTER TABLE public.ocade_organization_events
  DROP CONSTRAINT IF EXISTS ocade_organization_events_event;
ALTER TABLE public.ocade_organization_events
  ADD CONSTRAINT ocade_organization_events_event CHECK (
    event IN (
      'organization.created',
      'organization.renamed',
      'organization.deleted',
      'invite.sent',
      'invite.resent',
      'invite.accepted',
      'invite.revoked',
      'member.role_changed',
      'member.deactivated',
      'member.reactivated',
      'member.removed',
      'ownership.transferred',
      'group.created',
      'group.deleted',
      'group.member_added',
      'group.member_removed'
    )
  ) NOT VALID;

COMMIT;
