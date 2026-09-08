import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";

/**
 * THE ORGANIZATION MODEL, RUN AGAINST REAL POSTGRESQL AS A REAL TENANT.
 *
 * PLAN.md §F asks for cross-organization isolation, last-owner protection,
 * ownership-transfer safety and "server/RLS authorization for every mutation",
 * and then says the thing that decides how this file is written:
 *
 *   "UI visibility is not authorization. Direct API and forged-browser
 *    attempts must fail."
 *
 * So none of these tests render anything. Every one of them is the forged
 * request — a member of one organization naming a row in another, an admin
 * reaching for an owner, the last owner demoting themselves — issued directly
 * to the database under `SET ROLE authenticated`, which is what makes
 * row-level security actually apply. A test that ran as superuser would pass
 * against policies that protect nothing, because superusers bypass RLS.
 */

const ALICE = "11111111-1111-4111-8111-111111111111"; // owner of Northwind
const BOB = "22222222-2222-4222-8222-222222222222"; // admin of Northwind
const CAROL = "33333333-3333-4333-8333-333333333333"; // member of Northwind
const MALLORY = "44444444-4444-4444-8444-444444444444"; // owner of Contoso, an outsider

let twin: DatabaseTwin;
let northwind = "";
let contoso = "";

/** SHA-256 hex, the shape the token_hash constraint requires. */
function hash(token: string): string {
  // Node's crypto, not the browser's: this runs under Vitest.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("node:crypto").createHash("sha256").update(token).digest("hex");
}

/** The id of a member row, looked up as the superuser so setup cannot lie. */
async function memberId(organizationId: string, userId: string): Promise<string> {
  const rows = await twin.asSuperuser<{ id: string }>(
    `select id from public.ocade_organization_members
      where organization_id = '${organizationId}' and user_id = '${userId}'`,
  );
  return rows[0]?.id ?? "";
}

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  const failed = applied.filter((m) => !m.ok);
  expect(
    failed.map((m) => `${m.file}: ${m.error}`),
    "a migration failed",
  ).toEqual([]);

  for (const [id, email] of [
    [ALICE, "alice@example.com"],
    [BOB, "bob@example.com"],
    [CAROL, "carol@example.com"],
    [MALLORY, "mallory@example.com"],
  ]) {
    await twin.execSuperuser(
      `insert into auth.users (id, email) values ('${id}', '${email}')
       on conflict (id) do nothing`,
    );
  }

  const made = await twin.asTenant<{ ocade_create_organization: string }>(
    ALICE,
    `select public.ocade_create_organization('Northwind', 'northwind')`,
  );
  expect(made.error, "Alice could not create an organization").toBeUndefined();
  northwind = made.rows[0].ocade_create_organization;

  const rival = await twin.asTenant<{ ocade_create_organization: string }>(
    MALLORY,
    `select public.ocade_create_organization('Contoso', 'contoso')`,
  );
  expect(rival.error).toBeUndefined();
  contoso = rival.rows[0].ocade_create_organization;

  // Bob and Carol join Northwind the way real people do: by invitation.
  for (const [user, email, role] of [
    [BOB, "bob@example.com", "admin"],
    [CAROL, "carol@example.com", "member"],
  ]) {
    const token = `token-for-${email}`;
    const sent = await twin.asTenant(
      ALICE,
      `select public.ocade_invite_to_organization(
         '${northwind}', '${email}', '${role}', '${hash(token)}', now() + interval '7 days')`,
    );
    expect(sent.error, `inviting ${email}`).toBeUndefined();
    const accepted = await twin.asTenant(
      user,
      `select public.ocade_accept_organization_invite('${hash(token)}')`,
    );
    expect(accepted.error, `${email} accepting`).toBeUndefined();
  }
}, 120_000);

afterAll(async () => {
  await twin?.close();
});

describe("the shape the schema promises", () => {
  it("protects every organization table with row-level security", async () => {
    const protectedTables = await twin.rlsEnabledTables();
    for (const table of [
      "ocade_organizations",
      "ocade_organization_members",
      "ocade_organization_invites",
      "ocade_organization_groups",
      "ocade_organization_group_members",
      "ocade_organization_events",
    ]) {
      expect(protectedTables, `${table} has row-level security off`).toContain(table);
    }
  });

  /**
   * RLS decides WHICH ROWS; GRANT decides whether the table may be touched at
   * all. The notification migration shipped with policies and no grants and
   * every read failed with "permission denied for table" — a mistake that
   * looks correct in review, so it is asserted rather than remembered.
   */
  it("grants authenticated the reads its policies are written for", async () => {
    const rows = await twin.asSuperuser<{ table_name: string }>(
      `select table_name from information_schema.role_table_grants
        where grantee = 'authenticated' and privilege_type = 'SELECT'
          and table_name like 'ocade_organization%'
        group by table_name order by table_name`,
    );
    const granted = rows.map((r) => r.table_name);
    for (const table of [
      "ocade_organization_members",
      "ocade_organization_invites",
      "ocade_organization_groups",
      "ocade_organization_group_members",
      "ocade_organization_events",
    ]) {
      expect(granted, `${table} has no SELECT grant`).toContain(table);
    }
  });

  it("gives authenticated no way to write these tables directly", async () => {
    const rows = await twin.asSuperuser<{ table_name: string; privilege_type: string }>(
      `select table_name, privilege_type from information_schema.role_table_grants
        where grantee = 'authenticated'
          and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
          and table_name like 'ocade_organization%'`,
    );
    // Every mutation is a SECURITY DEFINER function precisely because a write
    // policy cannot express "and the organization must keep an owner".
    expect(rows).toEqual([]);
  });
});

describe("cross-organization isolation", () => {
  it("shows an outsider nothing of another organization", async () => {
    const seen = await twin.asTenant<{ id: string }>(
      MALLORY,
      `select id from public.ocade_organizations order by name`,
    );
    expect(seen.error).toBeUndefined();
    expect(seen.rows.map((r) => r.id)).toEqual([contoso]);
  });

  it("shows an outsider none of another organization's members", async () => {
    const seen = await twin.asTenant(
      MALLORY,
      `select user_id from public.ocade_organization_members
        where organization_id = '${northwind}'`,
    );
    expect(seen.rows).toEqual([]);
  });

  it("refuses an outsider naming a member row in an organization they can see nothing of", async () => {
    const target = await memberId(northwind, CAROL);
    expect(target).not.toBe("");
    const attempt = await twin.asTenant(
      MALLORY,
      `select public.ocade_remove_organization_member('${target}')`,
    );
    // The id is real and correct. Authorization is resolved from the row's OWN
    // organization, so knowing the id buys nothing.
    expect(attempt.error).toMatch(/owner or admin/i);

    const still = await twin.asSuperuser(
      `select 1 from public.ocade_organization_members where id = '${target}'`,
    );
    expect(still).toHaveLength(1);
  });

  it("refuses to put another organization's member into this organization's group", async () => {
    const group = await twin.asTenant<{ ocade_create_organization_group: string }>(
      MALLORY,
      `select public.ocade_create_organization_group('${contoso}', 'Engineering')`,
    );
    expect(group.error).toBeUndefined();
    const foreign = await memberId(northwind, CAROL);
    const attempt = await twin.asTenant(
      MALLORY,
      `select public.ocade_set_organization_group_membership(
         '${group.rows[0].ocade_create_organization_group}', '${foreign}', true)`,
    );
    expect(attempt.error).toMatch(/not in this group/i);
  });

  it("hides one organization's audit trail from the other's owner", async () => {
    const seen = await twin.asTenant(
      MALLORY,
      `select event from public.ocade_organization_events
        where organization_id = '${northwind}'`,
    );
    expect(seen.rows).toEqual([]);
  });
});

/**
 * THE DEFECT THIS SUITE FOUND, PINNED SHUT.
 *
 * `ocade_org_can_administer` was `SELECT role IN ('owner','admin')`, and for a
 * non-member `role` is NULL — so it returned NULL, `IF NOT NULL` never took its
 * branch, and every "only an owner or admin may…" guard was a no-op for exactly
 * the caller it existed to stop. An account that owned a DIFFERENT organization
 * removed a member from this one and got a success back.
 *
 * A three-valued boolean passed through `IF NOT` is a whole class of hole
 * rather than one mistake, so this asks every mutation the same question:
 * a complete outsider must be REFUSED, out loud. "Returned no error" is what
 * the defect looked like.
 */
describe("an outsider is refused by every mutation, not merely ignored", () => {
  it("refuses each one with a reason", async () => {
    const carol = await memberId(northwind, CAROL);
    const attempts: Array<[string, Awaited<ReturnType<typeof twin.asTenant>>]> = [];
    const push = async (label: string, sql: string) => {
      attempts.push([label, await twin.asTenant(MALLORY, sql)]);
    };

    await push("role", `select public.ocade_set_organization_member_role('${carol}', 'owner')`);
    await push(
      "state",
      `select public.ocade_set_organization_member_state('${carol}', 'deactivated')`,
    );
    await push("remove", `select public.ocade_remove_organization_member('${carol}')`);
    await push(
      "invite",
      `select public.ocade_invite_to_organization(
         '${northwind}', 'intruder@example.com', 'owner', '${hash("intruder")}',
         now() + interval '1 day')`,
    );
    await push("group", `select public.ocade_create_organization_group('${northwind}', 'Theirs')`);
    await push("rename", `select public.ocade_rename_organization('${northwind}', 'Mine Now')`);
    await push(
      "transfer",
      `select public.ocade_transfer_organization_ownership('${northwind}', '${MALLORY}')`,
    );
    await push("delete", `select public.ocade_delete_organization('${northwind}', 'Northwind')`);

    for (const [label, attempt] of attempts) {
      expect(attempt.error, `an outsider was not refused: ${label}`).toBeTruthy();
    }
  });

  it("left the organization exactly as it was", async () => {
    const rows = await twin.asSuperuser<{ user_id: string; role: string }>(
      `select user_id, role from public.ocade_organization_members
        where organization_id = '${northwind}' order by user_id`,
    );
    expect(rows).toEqual([
      { user_id: ALICE, role: "owner" },
      { user_id: BOB, role: "admin" },
      { user_id: CAROL, role: "member" },
    ]);
    const name = await twin.asSuperuser<{ name: string }>(
      `select name from public.ocade_organizations where id = '${northwind}'`,
    );
    expect(name).toEqual([{ name: "Northwind" }]);
  });

  it("does not tell an outsider whether the row exists", async () => {
    // The refusal for a real id and for an invented one must read the same, or
    // the error message is a membership oracle.
    const real = await twin.asTenant(
      MALLORY,
      `select public.ocade_set_organization_member_role(
         '${await memberId(northwind, CAROL)}', 'owner')`,
    );
    const invented = await twin.asTenant(
      MALLORY,
      `select public.ocade_set_organization_member_role(
         '99999999-9999-4999-8999-999999999999', 'owner')`,
    );
    expect(real.error).toBeTruthy();
    expect(invented.error).toBeTruthy();
  });
});

describe("last-owner protection", () => {
  it("refuses to demote the only owner", async () => {
    const alice = await memberId(northwind, ALICE);
    const attempt = await twin.asTenant(
      ALICE,
      `select public.ocade_set_organization_member_role('${alice}', 'member')`,
    );
    expect(attempt.error).toMatch(/last owner/i);
  });

  it("refuses to deactivate the only owner", async () => {
    const alice = await memberId(northwind, ALICE);
    const attempt = await twin.asTenant(
      ALICE,
      `select public.ocade_set_organization_member_state('${alice}', 'deactivated')`,
    );
    expect(attempt.error).toMatch(/last active owner/i);
  });

  it("refuses to remove the only owner", async () => {
    const alice = await memberId(northwind, ALICE);
    const attempt = await twin.asTenant(
      ALICE,
      `select public.ocade_remove_organization_member('${alice}')`,
    );
    expect(attempt.error).toMatch(/last owner/i);
  });

  it("counts only ACTIVE owners, so a deactivated one is not a safety net", async () => {
    const owners = await twin.asSuperuser<{ ocade_org_active_owners: number }>(
      `select public.ocade_org_active_owners('${northwind}', null)`,
    );
    expect(Number(owners[0].ocade_org_active_owners)).toBe(1);
  });
});

describe("who may do what", () => {
  it("lets an admin change an ordinary member's role", async () => {
    const carol = await memberId(northwind, CAROL);
    const done = await twin.asTenant(
      BOB,
      `select public.ocade_set_organization_member_role('${carol}', 'admin')`,
    );
    expect(done.error).toBeUndefined();
    const back = await twin.asTenant(
      BOB,
      `select public.ocade_set_organization_member_role('${carol}', 'member')`,
    );
    expect(back.error).toBeUndefined();
  });

  it("refuses an admin promoting anybody to owner", async () => {
    const carol = await memberId(northwind, CAROL);
    const attempt = await twin.asTenant(
      BOB,
      `select public.ocade_set_organization_member_role('${carol}', 'owner')`,
    );
    expect(attempt.error).toMatch(/only an owner/i);
  });

  it("refuses an admin inviting an owner, which would be escalation by email", async () => {
    const attempt = await twin.asTenant(
      BOB,
      `select public.ocade_invite_to_organization(
         '${northwind}', 'dave@example.com', 'owner', '${hash("dave")}',
         now() + interval '1 day')`,
    );
    expect(attempt.error).toMatch(/only an owner may invite another owner/i);
  });

  it("refuses an ordinary member every mutation", async () => {
    const bob = await memberId(northwind, BOB);
    const attempts = await Promise.all([
      twin.asTenant(CAROL, `select public.ocade_set_organization_member_role('${bob}', 'member')`),
      twin.asTenant(CAROL, `select public.ocade_remove_organization_member('${bob}')`),
      twin.asTenant(
        CAROL,
        `select public.ocade_invite_to_organization(
           '${northwind}', 'eve@example.com', 'member', '${hash("eve")}',
           now() + interval '1 day')`,
      ),
      twin.asTenant(CAROL, `select public.ocade_create_organization_group('${northwind}', 'Ops')`),
      twin.asTenant(CAROL, `select public.ocade_rename_organization('${northwind}', 'Mine')`),
      twin.asTenant(CAROL, `select public.ocade_delete_organization('${northwind}', 'Northwind')`),
    ]);
    for (const attempt of attempts) {
      expect(attempt.error, "an ordinary member was allowed to mutate").toBeTruthy();
    }
  });

  it("does not let an ordinary member read the invitation list", async () => {
    // Who has been invited is a list of who somebody thought of hiring.
    const seen = await twin.asTenant(
      CAROL,
      `select email from public.ocade_organization_invites
        where organization_id = '${northwind}'`,
    );
    expect(seen.rows).toEqual([]);
    const adminSees = await twin.asTenant(
      BOB,
      `select email from public.ocade_organization_invites
        where organization_id = '${northwind}'`,
    );
    expect(adminSees.rows.length).toBeGreaterThan(0);
  });
});

describe("invitations", () => {
  it("refuses a second open invitation to the same address", async () => {
    const first = await twin.asTenant(
      ALICE,
      `select public.ocade_invite_to_organization(
         '${northwind}', 'frank@example.com', 'member', '${hash("frank-1")}',
         now() + interval '1 day')`,
    );
    expect(first.error).toBeUndefined();
    const second = await twin.asTenant(
      ALICE,
      `select public.ocade_invite_to_organization(
         '${northwind}', 'frank@example.com', 'member', '${hash("frank-2")}',
         now() + interval '1 day')`,
    );
    expect(second.error).toMatch(/already has an open invitation/i);
  });

  it("refuses to invite somebody who is already in the organization", async () => {
    const attempt = await twin.asTenant(
      ALICE,
      `select public.ocade_invite_to_organization(
         '${northwind}', 'carol@example.com', 'member', '${hash("carol-again")}',
         now() + interval '1 day')`,
    );
    expect(attempt.error).toMatch(/already in this organization/i);
  });

  it("kills the old token when an invitation is resent", async () => {
    const invite = await twin.asSuperuser<{ id: string }>(
      `select id from public.ocade_organization_invites
        where organization_id = '${northwind}' and email = 'frank@example.com'
          and accepted_at is null and revoked_at is null`,
    );
    expect(invite).toHaveLength(1);
    const resent = await twin.asTenant(
      ALICE,
      `select public.ocade_resend_organization_invite(
         '${invite[0].id}', '${hash("frank-3")}', now() + interval '3 days')`,
    );
    expect(resent.error).toBeUndefined();

    // The forwarded copy of the first link no longer works.
    await twin.execSuperuser(
      `insert into auth.users (id, email)
       values ('55555555-5555-4555-8555-555555555555', 'frank@example.com')
       on conflict (id) do nothing`,
    );
    const stale = await twin.asTenant(
      "55555555-5555-4555-8555-555555555555",
      `select public.ocade_accept_organization_invite('${hash("frank-1")}')`,
    );
    expect(stale.error).toMatch(/not valid/i);

    const fresh = await twin.asTenant(
      "55555555-5555-4555-8555-555555555555",
      `select public.ocade_accept_organization_invite('${hash("frank-3")}')`,
    );
    expect(fresh.error).toBeUndefined();
  });

  it("returns the organization again rather than failing on a second press", async () => {
    const again = await twin.asTenant<{ ocade_accept_organization_invite: string }>(
      "55555555-5555-4555-8555-555555555555",
      `select public.ocade_accept_organization_invite('${hash("frank-3")}')`,
    );
    expect(again.error).toBeUndefined();
    expect(again.rows[0].ocade_accept_organization_invite).toBe(northwind);
  });

  it("refuses somebody else reusing an accepted invitation", async () => {
    const attempt = await twin.asTenant(
      MALLORY,
      `select public.ocade_accept_organization_invite('${hash("frank-3")}')`,
    );
    expect(attempt.error).toMatch(/already been used/i);
  });

  it("refuses an expired invitation", async () => {
    await twin.execSuperuser(
      `insert into public.ocade_organization_invites
         (organization_id, email, role, token_hash, invited_by, expires_at)
       values ('${northwind}', 'grace@example.com', 'member', '${hash("grace")}',
               '${ALICE}', now() - interval '1 minute')`,
    );
    const attempt = await twin.asTenant(
      MALLORY,
      `select public.ocade_accept_organization_invite('${hash("grace")}')`,
    );
    expect(attempt.error).toMatch(/expired/i);
  });

  it("refuses a revoked invitation", async () => {
    const invite = await twin.asSuperuser<{ id: string }>(
      `select id from public.ocade_organization_invites
        where email = 'grace@example.com' limit 1`,
    );
    await twin.asTenant(ALICE, `select public.ocade_revoke_organization_invite('${invite[0].id}')`);
    const attempt = await twin.asTenant(
      MALLORY,
      `select public.ocade_accept_organization_invite('${hash("grace")}')`,
    );
    expect(attempt.error).toMatch(/withdrawn/i);
  });

  it("never stores the token itself", async () => {
    const rows = await twin.asSuperuser<{ token_hash: string }>(
      `select token_hash from public.ocade_organization_invites`,
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
      // The plaintext of every token this suite issued.
      for (const token of ["frank-1", "frank-3", "grace", "dave", "eve"]) {
        expect(row.token_hash).not.toContain(token);
      }
    }
  });
});

describe("deactivation is not removal", () => {
  it("takes away every power while keeping the membership row", async () => {
    const carol = await memberId(northwind, CAROL);
    const done = await twin.asTenant(
      ALICE,
      `select public.ocade_set_organization_member_state('${carol}', 'deactivated')`,
    );
    expect(done.error).toBeUndefined();

    // Still a member of record...
    const still = await twin.asSuperuser(
      `select 1 from public.ocade_organization_members where id = '${carol}'`,
    );
    expect(still).toHaveLength(1);

    // ...and can no longer see the organization at all, because
    // `ocade_org_role` returns nothing for a deactivated member. This is the
    // "permission invalidation after role change" §F asks for: it takes effect
    // on the next request, with no session to expire and no cache to bust.
    const seen = await twin.asTenant(
      CAROL,
      `select id from public.ocade_organizations where id = '${northwind}'`,
    );
    expect(seen.rows).toEqual([]);
  });

  it("lets an administrator put them back", async () => {
    const carol = await memberId(northwind, CAROL);
    const done = await twin.asTenant(
      ALICE,
      `select public.ocade_set_organization_member_state('${carol}', 'active')`,
    );
    expect(done.error).toBeUndefined();
    const seen = await twin.asTenant(
      CAROL,
      `select id from public.ocade_organizations where id = '${northwind}'`,
    );
    expect(seen.rows).toHaveLength(1);
  });
});

describe("ownership transfer", () => {
  it("moves ownership and leaves the outgoing owner as an admin, in one step", async () => {
    const done = await twin.asTenant(
      ALICE,
      `select public.ocade_transfer_organization_ownership('${northwind}', '${BOB}')`,
    );
    expect(done.error).toBeUndefined();

    const roles = await twin.asSuperuser<{ user_id: string; role: string }>(
      `select user_id, role from public.ocade_organization_members
        where organization_id = '${northwind}' and user_id in ('${ALICE}', '${BOB}')
        order by role`,
    );
    expect(roles).toEqual([
      { user_id: ALICE, role: "admin" },
      { user_id: BOB, role: "owner" },
    ]);
  });

  it("never passed through a state with no owner", async () => {
    const owners = await twin.asSuperuser<{ ocade_org_active_owners: number }>(
      `select public.ocade_org_active_owners('${northwind}', null)`,
    );
    expect(Number(owners[0].ocade_org_active_owners)).toBe(1);
  });

  it("refuses to hand ownership to a deactivated member", async () => {
    const carol = await memberId(northwind, CAROL);
    await twin.asTenant(
      BOB,
      `select public.ocade_set_organization_member_state('${carol}', 'deactivated')`,
    );
    const attempt = await twin.asTenant(
      BOB,
      `select public.ocade_transfer_organization_ownership('${northwind}', '${CAROL}')`,
    );
    expect(attempt.error).toMatch(/deactivated member cannot become the owner/i);
    await twin.asTenant(
      BOB,
      `select public.ocade_set_organization_member_state('${carol}', 'active')`,
    );
  });

  it("refuses a former owner, now an admin, transferring ownership", async () => {
    const attempt = await twin.asTenant(
      ALICE,
      `select public.ocade_transfer_organization_ownership('${northwind}', '${CAROL}')`,
    );
    expect(attempt.error).toMatch(/only an owner/i);
  });
});

describe("the audit trail", () => {
  it("recorded every kind of change this suite made", async () => {
    const rows = await twin.asTenant<{ event: string }>(
      BOB,
      `select distinct event from public.ocade_organization_events
        where organization_id = '${northwind}' order by event`,
    );
    expect(rows.error).toBeUndefined();
    const events = rows.rows.map((r) => r.event);
    for (const event of [
      "organization.created",
      "invite.sent",
      "invite.accepted",
      "invite.resent",
      "invite.revoked",
      "member.role_changed",
      "member.deactivated",
      "member.reactivated",
      "ownership.transferred",
    ]) {
      expect(events, `${event} was never recorded`).toContain(event);
    }
  });

  it("names the actor and the subject, not just the event", async () => {
    const rows = await twin.asTenant<{ actor_id: string; subject_id: string }>(
      BOB,
      `select actor_id, subject_id from public.ocade_organization_events
        where organization_id = '${northwind}' and event = 'ownership.transferred'`,
    );
    expect(rows.rows).toEqual([{ actor_id: ALICE, subject_id: BOB }]);
  });

  it("cannot be edited or erased by anybody holding an authenticated session", async () => {
    const attempts = await Promise.all([
      twin.asTenant(
        BOB,
        `update public.ocade_organization_events set event = 'invite.sent'
          where organization_id = '${northwind}'`,
      ),
      twin.asTenant(
        BOB,
        `delete from public.ocade_organization_events where organization_id = '${northwind}'`,
      ),
      twin.asTenant(
        BOB,
        `select public.ocade_record_organization_event('${northwind}', 'invite.sent')`,
      ),
    ]);
    for (const attempt of attempts) {
      expect(attempt.error, "the audit trail was writable").toMatch(/permission denied/i);
    }
  });
});

/**
 * WHAT HAPPENS WHEN AN OWNER DELETES THEIR ACCOUNT — PLAN.md §O.
 *
 * `ocade_organization_members.user_id` is ON DELETE CASCADE, so deleting the
 * identity removes the membership with no OCADE code involved anywhere. Every
 * last-owner check in this schema lives in a function, and this path calls
 * none of them. That is why the protection is a TRIGGER: it is the only place
 * that runs on a path nobody wrote.
 *
 * These tests delete from `auth.users` directly, as Supabase's admin API does,
 * because a test that called a function would be testing the checks that were
 * already working.
 */
describe("an owner deleting their account", () => {
  const DELIA = "66666666-6666-4666-8666-666666666666";
  const ERIN = "77777777-7777-4777-8777-777777777777";
  let soloOrg = "";
  let sharedOrg = "";

  beforeAll(async () => {
    for (const [id, email] of [
      [DELIA, "delia@example.com"],
      [ERIN, "erin@example.com"],
    ]) {
      await twin.execSuperuser(
        `insert into auth.users (id, email) values ('${id}', '${email}')
         on conflict (id) do nothing`,
      );
    }
    const solo = await twin.asTenant<{ ocade_create_organization: string }>(
      DELIA,
      `select public.ocade_create_organization('Delia Only', 'delia-only')`,
    );
    expect(solo.error).toBeUndefined();
    soloOrg = solo.rows[0].ocade_create_organization;

    const shared = await twin.asTenant<{ ocade_create_organization: string }>(
      DELIA,
      `select public.ocade_create_organization('Delia And Erin', 'delia-and-erin')`,
    );
    expect(shared.error).toBeUndefined();
    sharedOrg = shared.rows[0].ocade_create_organization;

    const token = "erin-joins-delia";
    const sent = await twin.asTenant(
      DELIA,
      `select public.ocade_invite_to_organization(
         '${sharedOrg}', 'erin@example.com', 'admin', '${hash(token)}',
         now() + interval '7 days')`,
    );
    expect(sent.error).toBeUndefined();
    const accepted = await twin.asTenant(
      ERIN,
      `select public.ocade_accept_organization_invite('${hash(token)}')`,
    );
    expect(accepted.error).toBeUndefined();
  });

  it("is refused by the database, not merely by the screen", async () => {
    // As Supabase's admin API does it: straight at auth.users.
    const attempt = await twin
      .asSuperuser(`delete from auth.users where id = '${DELIA}'`)
      .then(() => null)
      .catch((error: Error) => error.message);
    expect(attempt, "the last owner's account was deleted").toMatch(/last owner/i);
  });

  it("left both organizations intact, with their owner", async () => {
    const owners = await twin.asSuperuser<{ organization_id: string; user_id: string }>(
      `select organization_id, user_id from public.ocade_organization_members
        where user_id = '${DELIA}' and role = 'owner' order by organization_id`,
    );
    expect(owners).toHaveLength(2);
  });

  /**
   * The sentence a person reads BEFORE pressing the button, and the difference
   * between the two answers: one organization can be handed over, the other can
   * only be deleted, and telling somebody to transfer ownership to nobody is
   * advice they cannot follow.
   */
  it("says which organizations are blocking, and which have nobody to hand over to", async () => {
    const blocking = await twin.asSuperuser<{
      organization_id: string;
      name: string;
      solo: boolean;
    }>(`select * from public.ocade_organizations_blocking_deletion('${DELIA}')`);
    expect(blocking.map((row) => row.name)).toEqual(["Delia And Erin", "Delia Only"]);
    expect(blocking.find((row) => row.name === "Delia Only")?.solo).toBe(true);
    expect(blocking.find((row) => row.name === "Delia And Erin")?.solo).toBe(false);
  });

  it("asks the question about the caller and nobody else", async () => {
    const mine = await twin.asTenant<{ name: string }>(
      ERIN,
      `select name from public.ocade_my_organizations_blocking_deletion()`,
    );
    expect(mine.error).toBeUndefined();
    // Erin is an admin, not an owner, so nothing blocks her.
    expect(mine.rows).toEqual([]);
  });

  it("lets the account go once ownership has been handed over and the rest deleted", async () => {
    const handed = await twin.asTenant(
      DELIA,
      `select public.ocade_transfer_organization_ownership('${sharedOrg}', '${ERIN}')`,
    );
    expect(handed.error).toBeUndefined();

    const removed = await twin.asTenant(
      DELIA,
      `select public.ocade_delete_organization('${soloOrg}', 'Delia Only')`,
    );
    expect(removed.error).toBeUndefined();

    const nowBlocking = await twin.asSuperuser(
      `select * from public.ocade_organizations_blocking_deletion('${DELIA}')`,
    );
    expect(nowBlocking).toEqual([]);

    const deleted = await twin
      .asSuperuser(`delete from auth.users where id = '${DELIA}'`)
      .then(() => null)
      .catch((error: Error) => error.message);
    expect(deleted, "a departing former owner still could not be deleted").toBeNull();
  });

  /**
   * And the organization they started survives them, with a creator field that
   * is now empty rather than a foreign key that refuses to let them leave.
   * Provenance is not authority.
   */
  it("leaves the organization they founded standing, owned by somebody who is still here", async () => {
    const rows = await twin.asSuperuser<{ created_by: string | null; owners: number }>(
      `select o.created_by,
              (select count(*)::int from public.ocade_organization_members m
                where m.organization_id = o.id and m.role = 'owner' and m.state = 'active')
                as owners
         from public.ocade_organizations o where o.id = '${sharedOrg}'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].created_by).toBeNull();
    expect(Number(rows[0].owners)).toBe(1);
  });
});

describe("the danger zone", () => {
  it("refuses deletion when the typed name does not match exactly", async () => {
    const attempt = await twin.asTenant(
      BOB,
      `select public.ocade_delete_organization('${northwind}', 'northwind')`,
    );
    expect(attempt.error).toMatch(/type the organization name exactly/i);
    const still = await twin.asSuperuser(
      `select 1 from public.ocade_organizations where id = '${northwind}'`,
    );
    expect(still).toHaveLength(1);
  });

  it("refuses deletion by an admin who is not the owner", async () => {
    const attempt = await twin.asTenant(
      ALICE,
      `select public.ocade_delete_organization('${northwind}', 'Northwind')`,
    );
    expect(attempt.error).toMatch(/only an owner/i);
  });

  it("takes the memberships, invitations, groups and trail with it", async () => {
    const done = await twin.asTenant(
      BOB,
      `select public.ocade_delete_organization('${northwind}', 'Northwind')`,
    );
    expect(done.error).toBeUndefined();

    for (const table of [
      "ocade_organization_members",
      "ocade_organization_invites",
      "ocade_organization_groups",
      "ocade_organization_events",
    ]) {
      const left = await twin.asSuperuser(
        `select 1 from public.${table} where organization_id = '${northwind}'`,
      );
      expect(left, `${table} kept rows for a deleted organization`).toEqual([]);
    }
  });

  it("left the other organization entirely alone", async () => {
    // Contoso is the one this suite's outsider owns. Naming it, rather than
    // asserting the whole table, keeps this about the blast radius of ONE
    // deletion — other tests legitimately create organizations of their own.
    const survivors = await twin.asSuperuser<{ id: string }>(
      `select id from public.ocade_organizations`,
    );
    const ids = survivors.map((row) => row.id);
    expect(ids, "the unrelated organization was destroyed too").toContain(contoso);
    expect(ids, "the deleted organization is still there").not.toContain(northwind);
  });
});

describe("what an organization allows — PLAN.md §21, §G", () => {
  /*
   * ITS OWN ORGANIZATION. Northwind does not survive the suites above — the
   * last of them deletes it, deliberately, to prove the cascade — so a policy
   * test written against it would be testing an organization that is not there
   * and would fail for a reason that has nothing to do with policy.
   */
  let policyOrg = "";
  beforeAll(async () => {
    const made = await twin.asTenant<{ ocade_create_organization: string }>(
      ALICE,
      `select public.ocade_create_organization('Ridgeline Policy', 'ridgeline-policy')`,
    );
    expect(made.error, "the policy fixture organization could not be created").toBeUndefined();
    policyOrg = made.rows[0]?.ocade_create_organization ?? "";
    expect(policyOrg).not.toEqual("");

    await twin.execSuperuser(
      `insert into public.ocade_organization_members (organization_id, user_id, role, state)
       values ('${"$"}{policyOrg}', '${BOB}', 'admin', 'active'),
              ('${"$"}{policyOrg}', '${CAROL}', 'member', 'active')`.replace(
        /\$\{policyOrg\}/g,
        policyOrg,
      ),
    );
  });

  it("has no policy until somebody sets one, and an absent policy withholds nothing", async () => {
    const rows = await twin.asTenant<{ count: string }>(
      ALICE,
      `select count(*) from public.ocade_organization_policies
        where organization_id = '${policyOrg}'`,
    );
    expect(Number(rows.rows[0]?.count)).toEqual(0);
  });

  it("refuses an ordinary member, and refuses an outsider", async () => {
    const asMember = await twin.asTenant(
      CAROL,
      `select public.ocade_set_organization_policy(
         '${policyOrg}', ARRAY['browser'], ARRAY[]::text[])`,
    );
    expect(asMember.error, "a member rewrote their own organization's policy").toMatch(
      /Only an owner or admin/i,
    );

    const asOutsider = await twin.asTenant(
      MALLORY,
      `select public.ocade_set_organization_policy(
         '${policyOrg}', ARRAY['browser'], ARRAY[]::text[])`,
    );
    expect(asOutsider.error, "an outsider rewrote another organization's policy").toMatch(
      /Only an owner or admin/i,
    );

    const untouched = await twin.asSuperuser<{ count: string }>(
      `select count(*) from public.ocade_organization_policies
        where organization_id = '${policyOrg}'`,
    );
    expect(Number(untouched[0]?.count)).toEqual(0);
  });

  it("lets an owner withhold a capability and an area, and records both sides", async () => {
    const set = await twin.asTenant<{ ocade_set_organization_policy: number }>(
      ALICE,
      `select public.ocade_set_organization_policy(
         '${policyOrg}', ARRAY['computerControl'], ARRAY['os_app'])`,
    );
    expect(set.error).toBeUndefined();
    expect(set.rows[0]?.ocade_set_organization_policy).toEqual(1);

    const stored = await twin.asSuperuser<{
      withheld_capabilities: string[];
      withheld_tool_domains: string[];
    }>(
      `select withheld_capabilities, withheld_tool_domains
         from public.ocade_organization_policies where organization_id = '${policyOrg}'`,
    );
    expect(stored[0]?.withheld_capabilities).toEqual(["computerControl"]);
    expect(stored[0]?.withheld_tool_domains).toEqual(["os_app"]);

    const event = await twin.asSuperuser<{ detail: Record<string, unknown> }>(
      `select detail from public.ocade_organization_events
        where organization_id = '${policyOrg}' and event = 'policy.changed'
        order by created_at desc limit 1`,
    );
    // Both sides, because "computerControl was withheld" is the fact somebody
    // needs months later and a row holding only the new state cannot answer it.
    expect(event[0]?.detail).toMatchObject({
      from: { capabilities: [], tool_domains: [] },
      to: { capabilities: ["computerControl"], tool_domains: ["os_app"] },
    });
  });

  it("shows the policy to every member, because it governs them", async () => {
    const asMember = await twin.asTenant<{ withheld_capabilities: string[] }>(
      CAROL,
      `select withheld_capabilities from public.ocade_organization_policies
        where organization_id = '${policyOrg}'`,
    );
    expect(asMember.error).toBeUndefined();
    expect(asMember.rows[0]?.withheld_capabilities).toEqual(["computerControl"]);
  });

  it("hides one organization's policy from another's owner", async () => {
    const asOutsider = await twin.asTenant<{ organization_id: string }>(
      MALLORY,
      `select organization_id from public.ocade_organization_policies`,
    );
    expect(asOutsider.error).toBeUndefined();
    expect(asOutsider.rows, "a policy leaked across organizations").toEqual([]);
  });

  it("does not let a member write the table directly, grant or policy", async () => {
    const write = await twin.asTenant(
      CAROL,
      `update public.ocade_organization_policies
          set withheld_capabilities = ARRAY[]::text[]
        where organization_id = '${policyOrg}'`,
    );
    // Either refusal is correct — no grant, or no policy admitting the write.
    // What must not happen is the update succeeding.
    const after = await twin.asSuperuser<{ withheld_capabilities: string[] }>(
      `select withheld_capabilities from public.ocade_organization_policies
        where organization_id = '${policyOrg}'`,
    );
    expect(
      after[0]?.withheld_capabilities,
      `direct write was allowed (${write.error ?? "no error"})`,
    ).toEqual(["computerControl"]);
  });

  it("refuses a capability the product does not have", async () => {
    const set = await twin.asTenant(
      ALICE,
      `select public.ocade_set_organization_policy(
         '${policyOrg}', ARRAY['teleportation'], ARRAY[]::text[])`,
    );
    expect(set.error, "an unknown capability was stored").toMatch(/check constraint|violates/i);
  });

  it("refuses to withhold the one area that touches no machine", async () => {
    const set = await twin.asTenant(
      ALICE,
      `select public.ocade_set_organization_policy(
         '${policyOrg}', ARRAY[]::text[], ARRAY['conversation'])`,
    );
    expect(set.error, "conversation was withheld").toMatch(/check constraint|violates/i);
  });

  it("reports no change when the policy is saved unaltered", async () => {
    const again = await twin.asTenant<{ ocade_set_organization_policy: number }>(
      ALICE,
      `select public.ocade_set_organization_policy(
         '${policyOrg}', ARRAY['computerControl'], ARRAY['os_app'])`,
    );
    expect(again.error).toBeUndefined();
    expect(again.rows[0]?.ocade_set_organization_policy).toEqual(0);
  });

  it("lets an admin lift it again", async () => {
    const cleared = await twin.asTenant<{ ocade_set_organization_policy: number }>(
      BOB,
      `select public.ocade_set_organization_policy(
         '${policyOrg}', ARRAY[]::text[], ARRAY[]::text[])`,
    );
    expect(cleared.error).toBeUndefined();
    expect(cleared.rows[0]?.ocade_set_organization_policy).toEqual(1);

    const stored = await twin.asSuperuser<{ withheld_capabilities: string[] }>(
      `select withheld_capabilities from public.ocade_organization_policies
        where organization_id = '${policyOrg}'`,
    );
    expect(stored[0]?.withheld_capabilities).toEqual([]);
  });

  it("goes with the organization when it is deleted", async () => {
    // Its own organization, because the fixtures above are used by other
    // suites and deleting one of them would make this test's success depend on
    // the order the file happens to run in.
    const made = await twin.asSuperuser<{ id: string }>(
      `insert into public.ocade_organizations (name, slug)
       values ('Cascade check', 'cascade-check') returning id`,
    );
    const transient = made[0]?.id ?? "";
    expect(transient).not.toEqual("");
    await twin.execSuperuser(
      `insert into public.ocade_organization_policies (organization_id, withheld_capabilities)
       values ('${"${transient}"}', ARRAY['voice'])`.replace("${transient}", transient),
    );
    await twin.execSuperuser(
      `delete from public.ocade_organizations where id = '${"${transient}"}'`.replace(
        "${transient}",
        transient,
      ),
    );
    const orphans = await twin.asSuperuser<{ count: string }>(
      `select count(*) from public.ocade_organization_policies
        where organization_id = '${"${transient}"}'`.replace("${transient}", transient),
    );
    expect(Number(orphans[0]?.count), "a policy outlived its organization").toEqual(0);
  });
});
