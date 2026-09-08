/**
 * What an organization is, in the shapes the screens actually use.
 *
 * Kept apart from the Supabase calls so the RULES — who may do what, what a
 * pending invitation is, when a member counts as the last owner — are testable
 * without a database and cannot drift between the screens that ask them.
 *
 * THE ROLES ARE OCADE'S, NOT FICIA'S. `tenants` and `tenant_members` exist in
 * the same schema with owner, manager, employee, accountant, auditor,
 * consultant and advisor. That vocabulary describes a BUSINESS; this one
 * describes who may act inside a workspace, which is a different question with
 * three answers.
 */

export const ORGANIZATION_ROLES = ["owner", "admin", "member"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const MEMBER_STATES = ["active", "deactivated"] as const;
export type MemberState = (typeof MEMBER_STATES)[number];

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  role: OrganizationRole;
  state: MemberState;
  joinedAt: string;
  /** From the profile, when one is readable. Never the authorisation. */
  displayName: string | null;
  email: string | null;
}

export interface OrganizationInvite {
  id: string;
  email: string;
  role: OrganizationRole;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export interface OrganizationGroup {
  id: string;
  name: string;
  memberIds: readonly string[];
}

export interface OrganizationEvent {
  id: string;
  event: string;
  actorId: string | null;
  subjectId: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}

/**
 * Which lists came back at their cap.
 *
 * A screen that showed the first five hundred members as though they were all
 * of them would be lying quietly; this is what lets it say so instead.
 */
export interface TruncatedLists {
  members: boolean;
  invites: boolean;
  groups: boolean;
  events: boolean;
}

/** The whole organization as one screen needs it. */
export interface OrganizationSnapshot {
  organization: Organization;
  role: OrganizationRole;
  truncated: TruncatedLists;
  members: readonly OrganizationMember[];
  invites: readonly OrganizationInvite[];
  groups: readonly OrganizationGroup[];
  events: readonly OrganizationEvent[];
}

export function isOrganizationRole(value: unknown): value is OrganizationRole {
  return typeof value === "string" && (ORGANIZATION_ROLES as readonly string[]).includes(value);
}

export function isMemberState(value: unknown): value is MemberState {
  return typeof value === "string" && (MEMBER_STATES as readonly string[]).includes(value);
}

/** True when this account may administer the organization. */
export function canAdminister(role: OrganizationRole | null): boolean {
  return role === "owner" || role === "admin";
}

/**
 * An invitation's state, as a person would describe it.
 *
 * Four states rather than a boolean, because "expired" and "withdrawn" are the
 * two a person asks about and a `pending: false` flag answers neither.
 */
export type InviteState = "pending" | "accepted" | "revoked" | "expired";

export function inviteState(invite: OrganizationInvite, now: Date = new Date()): InviteState {
  if (invite.acceptedAt) return "accepted";
  if (invite.revokedAt) return "revoked";
  if (Date.parse(invite.expiresAt) <= now.getTime()) return "expired";
  return "pending";
}

/**
 * How many ACTIVE owners would remain if this member changed.
 *
 * The same arithmetic the database enforces, repeated here for ONE purpose: to
 * disable a control before somebody presses it and reads a refusal. It is not
 * the protection — `ocade_org_active_owners` is, and it runs whether or not
 * this function was ever called.
 */
export function activeOwnersExcluding(
  members: readonly OrganizationMember[],
  excludeMemberId: string | null,
): number {
  return members.filter(
    (member) =>
      member.role === "owner" && member.state === "active" && member.id !== excludeMemberId,
  ).length;
}

/** Why a member cannot be changed right now, or null when they can. */
export function blockedReason(
  members: readonly OrganizationMember[],
  member: OrganizationMember,
  action: "demote" | "deactivate" | "remove",
): string | null {
  if (member.role !== "owner") return null;
  if (activeOwnersExcluding(members, member.id) > 0) return null;
  return action === "remove"
    ? "This is the last owner. Transfer ownership before removing them."
    : "This is the last owner. Make somebody else an owner first.";
}

/**
 * A URL-safe handle suggested from a name.
 *
 * SUGGESTED, NOT IMPOSED. The database refuses to derive it, because two
 * organizations may legitimately be called "Design" and a slug that silently
 * became "design-2" is a name nobody chose. This fills the field so it can be
 * edited, and returns "" when nothing usable survives rather than inventing
 * something.
 */
export function suggestSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return slug.length >= 3 ? slug : "";
}

/** The constraint the database holds, so the field can say so before saving. */
export function slugProblem(slug: string): string | null {
  if (!slug) return "Choose a handle.";
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) {
    return "Use 3 to 40 characters: lowercase letters, numbers and hyphens, not starting or ending with a hyphen.";
  }
  return null;
}

/** Matching used by the member and invitation filters §F asks for. */
export function matchesSearch(member: OrganizationMember, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [member.displayName, member.email, member.role, member.state].some(
    (field) => typeof field === "string" && field.toLowerCase().includes(needle),
  );
}
