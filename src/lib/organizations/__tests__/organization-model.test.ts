import { describe, expect, it } from "vitest";
import {
  activeOwnersExcluding,
  blockedReason,
  canAdminister,
  inviteState,
  matchesSearch,
  slugProblem,
  suggestSlug,
  type OrganizationInvite,
  type OrganizationMember,
} from "../model";
import { createInviteToken, hashInviteToken, inviteExpiry, inviteLink } from "../invite-token";

/**
 * The rules the organization screens ask, tested without a database.
 *
 * None of this is the protection — the schema is, and its own suite proves it
 * under `SET ROLE authenticated`. What is tested here is whether a control is
 * disabled BEFORE somebody presses it and reads a refusal, and whether the
 * words a person sees match what the server will actually do.
 */

function member(overrides: Partial<OrganizationMember> = {}): OrganizationMember {
  return {
    id: "member-1",
    userId: "user-1",
    role: "member",
    state: "active",
    joinedAt: "2026-01-01T00:00:00.000Z",
    displayName: "Sam Rivera",
    email: "sam@example.com",
    ...overrides,
  };
}

describe("who may administer", () => {
  it("is owners and admins, and nobody else", () => {
    expect(canAdminister("owner")).toBe(true);
    expect(canAdminister("admin")).toBe(true);
    expect(canAdminister("member")).toBe(false);
    expect(canAdminister(null)).toBe(false);
  });
});

describe("last-owner protection, as the screen sees it", () => {
  const owner = member({ id: "owner-1", userId: "owner", role: "owner" });
  const second = member({ id: "owner-2", userId: "second", role: "owner" });
  const ordinary = member({ id: "member-1" });

  it("counts only active owners", () => {
    const deactivated = member({
      id: "owner-3",
      userId: "third",
      role: "owner",
      state: "deactivated",
    });
    expect(activeOwnersExcluding([owner, deactivated], null)).toBe(1);
    expect(activeOwnersExcluding([owner, second], null)).toBe(2);
    expect(activeOwnersExcluding([owner, second], "owner-2")).toBe(1);
  });

  it("blocks the last owner with the reason the server would give", () => {
    expect(blockedReason([owner, ordinary], owner, "remove")).toMatch(/transfer ownership/i);
    expect(blockedReason([owner, ordinary], owner, "demote")).toMatch(/somebody else an owner/i);
    expect(blockedReason([owner, ordinary], owner, "deactivate")).toMatch(
      /somebody else an owner/i,
    );
  });

  it("blocks nobody once a second owner exists", () => {
    expect(blockedReason([owner, second], owner, "remove")).toBeNull();
    expect(blockedReason([owner, second], second, "demote")).toBeNull();
  });

  it("never blocks an ordinary member", () => {
    expect(blockedReason([owner], ordinary, "remove")).toBeNull();
  });

  /**
   * A DEACTIVATED OWNER IS NOT A SAFETY NET, and this is the case that would
   * quietly get it wrong: the arithmetic looks like there are two owners, and
   * one of them cannot act.
   */
  it("still blocks when the only other owner is deactivated", () => {
    const suspended = member({
      id: "owner-2",
      userId: "second",
      role: "owner",
      state: "deactivated",
    });
    expect(blockedReason([owner, suspended], owner, "remove")).toMatch(/transfer ownership/i);
  });
});

describe("an invitation's state", () => {
  const base: OrganizationInvite = {
    id: "invite-1",
    email: "new@example.com",
    role: "member",
    createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-08T00:00:00.000Z",
    acceptedAt: null,
    revokedAt: null,
  };
  const now = new Date("2026-01-02T00:00:00.000Z");

  it("is pending while it is live", () => {
    expect(inviteState(base, now)).toBe("pending");
  });

  it("distinguishes expired from withdrawn, because a person asks about both", () => {
    expect(inviteState(base, new Date("2026-02-01T00:00:00.000Z"))).toBe("expired");
    expect(inviteState({ ...base, revokedAt: "2026-01-03T00:00:00.000Z" }, now)).toBe("revoked");
  });

  it("reports accepted even after the expiry passes", () => {
    const accepted = { ...base, acceptedAt: "2026-01-02T00:00:00.000Z" };
    expect(inviteState(accepted, new Date("2027-01-01T00:00:00.000Z"))).toBe("accepted");
  });
});

describe("the handle", () => {
  it("suggests one from a name without imposing it", () => {
    expect(suggestSlug("Northwind Traders")).toBe("northwind-traders");
    expect(suggestSlug("  Café Ötvös  ")).toBe("cafe-otvos");
  });

  it("returns nothing rather than inventing something unusable", () => {
    expect(suggestSlug("!!")).toBe("");
    expect(suggestSlug("ab")).toBe("");
  });

  it("rejects exactly what the database rejects", () => {
    expect(slugProblem("northwind")).toBeNull();
    expect(slugProblem("")).toMatch(/choose a handle/i);
    expect(slugProblem("-leading")).toMatch(/not starting or ending/i);
    expect(slugProblem("trailing-")).toMatch(/not starting or ending/i);
    expect(slugProblem("Upper")).toMatch(/lowercase/i);
    expect(slugProblem("a".repeat(41))).toMatch(/3 to 40/i);
  });
});

describe("search", () => {
  it("matches a name, an address, a role or a state", () => {
    const sam = member();
    expect(matchesSearch(sam, "")).toBe(true);
    expect(matchesSearch(sam, "RIVERA")).toBe(true);
    expect(matchesSearch(sam, "sam@")).toBe(true);
    expect(matchesSearch(sam, "member")).toBe(true);
    expect(matchesSearch(sam, "owner")).toBe(false);
  });

  it("does not fall over on a member with no profile", () => {
    const anonymous = member({ displayName: null, email: null });
    expect(matchesSearch(anonymous, "sam")).toBe(false);
    expect(matchesSearch(anonymous, "")).toBe(true);
  });
});

describe("the invitation token", () => {
  it("is unguessable, and different every time", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => createInviteToken()));
    expect(tokens.size).toBe(200);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  it("hashes to the exact shape the database constraint requires", async () => {
    const hash = await hashInviteToken("token");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // SHA-256 of "token", so the hashing is the real thing rather than a stub.
    expect(hash).toBe("3c469e9d6c5875d37a43f353d4f88e61fcf812c66eee3457465a40b0da4153e0");
  });

  it("puts the token in the link and never anywhere else", () => {
    const token = "abc-123_XYZ";
    const link = inviteLink("https://ocade.example/", token);
    expect(link).toBe("https://ocade.example/invite?token=abc-123_XYZ");
  });

  it("expires a week out, which is what the screen tells people", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(inviteExpiry(now).toISOString()).toBe("2026-01-08T00:00:00.000Z");
  });
});
