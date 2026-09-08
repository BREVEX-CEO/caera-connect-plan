/**
 * The one place OCADE talks to the organization schema.
 *
 * EVERY MUTATION IS AN RPC, and that is not a style choice. The tables grant
 * `authenticated` nothing but SELECT; the writes live in SECURITY DEFINER
 * functions that resolve the caller's role in the organization the TARGET ROW
 * belongs to. So there is no `from(...).update(...)` in this file, and there is
 * nowhere else in the product that could add one and have it work.
 *
 * READS ARE PLAIN SELECTS, and row-level security decides what comes back. A
 * member of one organization matches no row of another, so no query here
 * filters by organization for safety — only for the screen. Passing the wrong
 * id returns nothing rather than somebody else's team.
 *
 * ERRORS ARE RETURNED, NOT THROWN. Every refusal in the schema is a sentence
 * written for a person — "This is the last owner. Transfer ownership first." —
 * and a screen that swallowed it into a generic failure would be hiding the
 * only useful part.
 */

import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import type { AssuranceRefusal } from "@/lib/security/assurance";
import { assuranceRefusalOf } from "@/lib/security/reauthentication";
import {
  ceilingFrom,
  isPolicyCapability,
  isPolicyToolDomain,
  NO_CEILING,
  type OrganizationPolicy,
  type PolicyCeiling,
} from "./policy";
import {
  isMemberState,
  isOrganizationRole,
  type MemberState,
  type Organization,
  type OrganizationEvent,
  type OrganizationGroup,
  type OrganizationInvite,
  type OrganizationMember,
  type OrganizationRole,
  type OrganizationSnapshot,
} from "./model";

/**
 * The result of anything that can be refused.
 *
 * `reason` is present only when the database declined on ASSURANCE grounds —
 * the session is not strong enough, or its last proof of identity is too old.
 * It is separate from `message` because the two lead to different controls: one
 * needs an authenticator code, the other a password, and a screen that could
 * only read prose would have to guess which.
 */
export type Outcome<T> =
  { ok: true; value: T } | { ok: false; message: string; reason?: AssuranceRefusal };

/**
 * HOW MUCH OF AN ORGANIZATION ONE SCREEN LOADS.
 *
 * Every list here grows with use, and a query with no bound is a query that
 * works until the day somebody has a big enough team — at which point it stops
 * being slow and starts being a page that never renders. So each read is
 * capped, and the snapshot says when a cap was reached rather than quietly
 * showing a prefix as though it were the whole thing: a member list that is
 * silently missing people is worse than one that admits it.
 *
 * The caps are deliberately generous. An organization past them needs paging
 * and server-side search, which is a different screen; what matters here is
 * that the product tells the truth about which one it is showing.
 */
const LIMITS = {
  members: 500,
  invites: 200,
  groups: 100,
  groupMembers: 2_000,
  events: 200,
  /*
   * Policies are one row per organization, so this bounds "how many workspaces
   * one person may be in" rather than a list that grows with use. Far above any
   * real answer, and present because an unbounded read is a read that works
   * until it does not.
   */
  policies: 200,
} as const;

function failed(cause: unknown): { ok: false; message: string; reason?: AssuranceRefusal } {
  // Read BEFORE the message is tidied up: the reason is a machine token in a
  // different field, and it is what decides which control the screen offers.
  const reason = assuranceRefusalOf(cause);
  if (cause && typeof cause === "object" && "message" in cause) {
    const message = String((cause as { message: unknown }).message);
    /*
     * Postgres prefixes a RAISE with nothing, but PostgREST wraps it. The
     * sentence the schema wrote is the useful part; the wrapper is not.
     */
    const tidied = message.replace(/^.*?violates.*?:\s*/i, "").trim();
    return reason ? { ok: false, message: tidied, reason } : { ok: false, message: tidied };
  }
  return { ok: false, message: "Something went wrong. Try again." };
}

/** Organizations this account belongs to. Row-level security does the filtering. */
export async function listOrganizations(): Promise<Outcome<Organization[]>> {
  try {
    const supabase = await loadSupabaseClient();
    const { data, error } = await supabase
      .from("ocade_organizations")
      .select("id, name, slug, created_at")
      .order("name")
      .limit(LIMITS.groups);
    if (error) return failed(error);
    return {
      ok: true,
      value: (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        createdAt: row.created_at,
      })),
    };
  } catch (cause) {
    return failed(cause);
  }
}

/**
 * Everything one organization screen needs, in one place.
 *
 * The invitations, groups and audit trail come back EMPTY for an ordinary
 * member rather than failing, because their policies are admin-only and a
 * member reading zero rows is the policy working. The screen decides what to
 * show from `role`, which is the server's answer, not a guess.
 */
export async function loadOrganization(
  organizationId: string,
): Promise<Outcome<OrganizationSnapshot>> {
  try {
    const supabase = await loadSupabaseClient();

    const [organization, role] = await Promise.all([
      supabase
        .from("ocade_organizations")
        .select("id, name, slug, created_at")
        .eq("id", organizationId)
        .maybeSingle(),
      supabase.rpc("ocade_org_role", { p_organization_id: organizationId }),
    ]);
    if (organization.error) return failed(organization.error);
    if (!organization.data) {
      return { ok: false, message: "That organization does not exist, or you are not in it." };
    }
    if (role.error) return failed(role.error);
    if (!isOrganizationRole(role.data)) {
      return { ok: false, message: "You are not an active member of this organization." };
    }

    const [members, invites, groups, groupMembers, events] = await Promise.all([
      supabase
        .from("ocade_organization_members")
        .select("id, user_id, role, state, joined_at")
        .eq("organization_id", organizationId)
        .order("joined_at")
        .limit(LIMITS.members),
      supabase
        .from("ocade_organization_invites")
        .select("id, email, role, created_at, expires_at, accepted_at, revoked_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(LIMITS.invites),
      supabase
        .from("ocade_organization_groups")
        .select("id, name")
        .eq("organization_id", organizationId)
        .order("name")
        .limit(LIMITS.groups),
      /*
       * Row-level security already restricts this to groups the caller can see,
       * but "the organizations I belong to" is not a bound — somebody in ten
       * large workspaces would load all of them to render one. The cap keeps
       * the read proportional to the screen.
       */
      supabase
        .from("ocade_organization_group_members")
        .select("group_id, member_id")
        .limit(LIMITS.groupMembers),
      supabase
        .from("ocade_organization_events")
        .select("id, event, actor_id, subject_id, detail, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(LIMITS.events),
    ]);
    if (members.error) return failed(members.error);

    const profiles = await readProfiles(
      supabase,
      (members.data ?? []).map((row) => row.user_id),
    );

    const memberRows: OrganizationMember[] = (members.data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      role: isOrganizationRole(row.role) ? row.role : "member",
      state: isMemberState(row.state) ? row.state : "active",
      joinedAt: row.joined_at,
      displayName: profiles.get(row.user_id)?.displayName ?? null,
      email: profiles.get(row.user_id)?.email ?? null,
    }));

    const membersByGroup = new Map<string, string[]>();
    for (const link of groupMembers.data ?? []) {
      const list = membersByGroup.get(link.group_id) ?? [];
      list.push(link.member_id);
      membersByGroup.set(link.group_id, list);
    }

    return {
      ok: true,
      value: {
        organization: {
          id: organization.data.id,
          name: organization.data.name,
          slug: organization.data.slug,
          createdAt: organization.data.created_at,
        },
        role: role.data,
        truncated: {
          members: memberRows.length >= LIMITS.members,
          invites: (invites.data ?? []).length >= LIMITS.invites,
          groups: (groups.data ?? []).length >= LIMITS.groups,
          events: (events.data ?? []).length >= LIMITS.events,
        },
        members: memberRows,
        invites: (invites.data ?? []).map((row): OrganizationInvite => ({
          id: row.id,
          email: row.email,
          role: isOrganizationRole(row.role) ? row.role : "member",
          createdAt: row.created_at,
          expiresAt: row.expires_at,
          acceptedAt: row.accepted_at,
          revokedAt: row.revoked_at,
        })),
        groups: (groups.data ?? []).map((row): OrganizationGroup => ({
          id: row.id,
          name: row.name,
          memberIds: membersByGroup.get(row.id) ?? [],
        })),
        events: (events.data ?? []).map((row): OrganizationEvent => ({
          id: row.id,
          event: row.event,
          actorId: row.actor_id,
          subjectId: row.subject_id,
          detail:
            row.detail && typeof row.detail === "object" && !Array.isArray(row.detail)
              ? (row.detail as Record<string, unknown>)
              : {},
          createdAt: row.created_at,
        })),
      },
    };
  } catch (cause) {
    return failed(cause);
  }
}

interface ProfileSummary {
  displayName: string | null;
  email: string | null;
}

/**
 * Names for the member list, best-effort.
 *
 * A profile that policy hides comes back missing, and the row then shows the
 * account id. That is deliberately not an error: the MEMBERSHIP is the fact
 * this screen is about, and refusing to render a team because one profile is
 * private would be the wrong failure.
 */
async function readProfiles(
  supabase: Awaited<ReturnType<typeof loadSupabaseClient>>,
  userIds: readonly string[],
): Promise<Map<string, ProfileSummary>> {
  const summaries = new Map<string, ProfileSummary>();
  if (userIds.length === 0) return summaries;
  const unique = [...new Set(userIds)];
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .in("id", unique)
    .limit(unique.length);
  for (const row of data ?? []) {
    summaries.set(row.id, {
      displayName: row.display_name ?? null,
      email: row.email ?? null,
    });
  }
  return summaries;
}

async function call<T>(
  name: Parameters<Awaited<ReturnType<typeof loadSupabaseClient>>["rpc"]>[0],
  args: Record<string, unknown>,
): Promise<Outcome<T>> {
  try {
    const supabase = await loadSupabaseClient();
    // The RPC surface is typed by the generated schema; the argument maps below
    // are built from those signatures, so this cast narrows rather than widens.
    const { data, error } = await (
      supabase.rpc as unknown as (
        fn: string,
        params: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    )(name as unknown as string, args);
    if (error) return failed(error);
    return { ok: true, value: data as T };
  } catch (cause) {
    return failed(cause);
  }
}

/**
 * WHAT EVERY ORGANIZATION THIS ACCOUNT BELONGS TO WITHHOLDS — PLAN.md §21, §G.
 *
 * One read, not one per organization: row-level security already restricts the
 * policy table to workspaces the caller is a member of, so selecting all of
 * them returns exactly the caller's own and nobody else's. The organizations
 * are read alongside so a refusal can NAME the workspace — "an organization you
 * belong to has turned this off" sends somebody who belongs to three to ask
 * three administrators.
 *
 * FAILS OPEN, DELIBERATELY, AND THIS IS THE ONE PLACE IN THIS FILE THAT DOES.
 * The rest of the product fails closed because the cost of guessing wrong is
 * that somebody gets access they should not have. Here the cost runs the other
 * way: a policy that could not be read is a person locked out of their own
 * product by an outage in a table that, on the overwhelming majority of
 * accounts, is empty. The ceiling is a workspace's stated rules, not an
 * authorization boundary — every capability it can take away is still governed
 * by the check that actually protects it — so an unreadable policy resolves to
 * "nothing withheld" rather than to "everything withheld".
 */
export async function loadPolicyCeiling(): Promise<PolicyCeiling> {
  try {
    const supabase = await loadSupabaseClient();
    const [policies, organizations] = await Promise.all([
      supabase
        .from("ocade_organization_policies")
        .select("organization_id, withheld_capabilities, withheld_tool_domains, updated_at")
        .limit(LIMITS.policies),
      supabase.from("ocade_organizations").select("id, name").limit(LIMITS.policies),
    ]);
    if (policies.error || !policies.data) return NO_CEILING;

    const names = new Map<string, string>();
    for (const row of organizations.data ?? []) names.set(row.id, row.name);

    return ceilingFrom((policies.data ?? []).map(toPolicy), names);
  } catch {
    return NO_CEILING;
  }
}

/**
 * One organization's policy, as its own screen needs it.
 *
 * Absent means nothing is withheld, which is why a missing row is not an error:
 * a workspace that has never opened this screen has made no decision, and the
 * absence of a decision is "allowed".
 */
export async function loadOrganizationPolicy(
  organizationId: string,
): Promise<Outcome<OrganizationPolicy>> {
  try {
    const supabase = await loadSupabaseClient();
    const { data, error } = await supabase
      .from("ocade_organization_policies")
      .select("organization_id, withheld_capabilities, withheld_tool_domains, updated_at")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) return failed(error);
    return {
      ok: true,
      value: data
        ? toPolicy(data)
        : {
            organizationId,
            withheldCapabilities: [],
            withheldToolDomains: [],
            updatedAt: null,
          },
    };
  } catch (cause) {
    return failed(cause);
  }
}

/**
 * Read a stored policy row, dropping anything the product no longer knows.
 *
 * The database checks the vocabulary on write, so an unknown value here means
 * the product has RETIRED a capability since the policy was set. Silently
 * ignoring it is right — there is nothing left to withhold — and keeping it
 * would put a name on screen that means nothing to anybody reading it.
 */
function toPolicy(row: {
  organization_id: string;
  withheld_capabilities: string[] | null;
  withheld_tool_domains: string[] | null;
  updated_at: string | null;
}): OrganizationPolicy {
  return {
    organizationId: row.organization_id,
    withheldCapabilities: (row.withheld_capabilities ?? []).filter(isPolicyCapability),
    withheldToolDomains: (row.withheld_tool_domains ?? []).filter(isPolicyToolDomain),
    updatedAt: row.updated_at,
  };
}

/** Replace what an organization withholds. Owners and admins only. */
export function setOrganizationPolicy(input: {
  organizationId: string;
  withheldCapabilities: readonly string[];
  withheldToolDomains: readonly string[];
}): Promise<Outcome<number>> {
  return call("ocade_set_organization_policy", {
    p_organization_id: input.organizationId,
    p_withheld_capabilities: [...input.withheldCapabilities],
    p_withheld_tool_domains: [...input.withheldToolDomains],
  });
}

/**
 * The organizations this account cannot walk away from — PLAN.md §O.
 *
 * Asked by the Delete-account screen BEFORE the button, so somebody is told
 * what to do while they still have an account to do it with. The server asks
 * the same question again during deletion and refuses on its own; this one is
 * the warning, not the protection.
 *
 * `solo` separates the two answers because they need different actions: an
 * organization with other people in it can be handed over, and one with nobody
 * else in it can only be closed.
 */
export interface BlockingOrganization {
  organizationId: string;
  name: string;
  solo: boolean;
}

export async function organizationsBlockingAccountDeletion(): Promise<
  Outcome<BlockingOrganization[]>
> {
  try {
    const supabase = await loadSupabaseClient();
    const { data, error } = await supabase.rpc("ocade_my_organizations_blocking_deletion");
    if (error) return failed(error);
    return {
      ok: true,
      value: (data ?? []).map((row) => ({
        organizationId: row.organization_id,
        name: row.name,
        solo: row.solo,
      })),
    };
  } catch (cause) {
    return failed(cause);
  }
}

export function createOrganization(name: string, slug: string): Promise<Outcome<string>> {
  return call<string>("ocade_create_organization", { p_name: name, p_slug: slug });
}

export function renameOrganization(organizationId: string, name: string): Promise<Outcome<number>> {
  return call<number>("ocade_rename_organization", {
    p_organization_id: organizationId,
    p_name: name,
  });
}

/**
 * Delete an organization, confirming by name.
 *
 * The typed name goes to the SERVER, which compares it. A dialog that checked
 * it in the browser and then called a function that did not is a confirmation
 * a forged request skips.
 */
export function deleteOrganization(
  organizationId: string,
  typedName: string,
): Promise<Outcome<number>> {
  return call<number>("ocade_delete_organization", {
    p_organization_id: organizationId,
    p_typed_name: typedName,
  });
}

export function inviteToOrganization(input: {
  organizationId: string;
  email: string;
  role: OrganizationRole;
  tokenHash: string;
  expiresAt: Date;
}): Promise<Outcome<string>> {
  return call<string>("ocade_invite_to_organization", {
    p_organization_id: input.organizationId,
    p_email: input.email,
    p_role: input.role,
    p_token_hash: input.tokenHash,
    p_expires_at: input.expiresAt.toISOString(),
  });
}

export function resendOrganizationInvite(input: {
  inviteId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<Outcome<number>> {
  return call<number>("ocade_resend_organization_invite", {
    p_invite_id: input.inviteId,
    p_token_hash: input.tokenHash,
    p_expires_at: input.expiresAt.toISOString(),
  });
}

export function revokeOrganizationInvite(inviteId: string): Promise<Outcome<number>> {
  return call<number>("ocade_revoke_organization_invite", { p_invite_id: inviteId });
}

export function acceptOrganizationInvite(tokenHash: string): Promise<Outcome<string>> {
  return call<string>("ocade_accept_organization_invite", { p_token_hash: tokenHash });
}

export function setMemberRole(memberId: string, role: OrganizationRole): Promise<Outcome<number>> {
  return call<number>("ocade_set_organization_member_role", {
    p_member_id: memberId,
    p_role: role,
  });
}

export function setMemberState(memberId: string, state: MemberState): Promise<Outcome<number>> {
  return call<number>("ocade_set_organization_member_state", {
    p_member_id: memberId,
    p_state: state,
  });
}

export function removeMember(memberId: string): Promise<Outcome<number>> {
  return call<number>("ocade_remove_organization_member", { p_member_id: memberId });
}

export function transferOwnership(
  organizationId: string,
  toUserId: string,
): Promise<Outcome<number>> {
  return call<number>("ocade_transfer_organization_ownership", {
    p_organization_id: organizationId,
    p_to_user_id: toUserId,
  });
}

export function createGroup(organizationId: string, name: string): Promise<Outcome<string>> {
  return call<string>("ocade_create_organization_group", {
    p_organization_id: organizationId,
    p_name: name,
  });
}

export function deleteGroup(groupId: string): Promise<Outcome<number>> {
  return call<number>("ocade_delete_organization_group", { p_group_id: groupId });
}

export function setGroupMembership(
  groupId: string,
  memberId: string,
  present: boolean,
): Promise<Outcome<number>> {
  return call<number>("ocade_set_organization_group_membership", {
    p_group_id: groupId,
    p_member_id: memberId,
    p_present: present,
  });
}
