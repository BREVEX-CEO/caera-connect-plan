import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";
import { RECENT_PROOF_MS } from "@/lib/security/assurance";

/**
 * HIGH-RISK ORGANIZATION ACTIONS, ATTEMPTED FROM SESSIONS THAT SHOULD NOT PASS.
 *
 * The defect these tests pin was not a missing rule. OCADE already had one —
 * `assurance.ts`, pure and exhaustively tested — and it was enforced by
 * `requireAssurance(HIGH_RISK)` on every server function that does something
 * irreversible. The organization mutations are RPCs the browser calls
 * DIRECTLY, so no middleware ever ran in front of them, and `PLAN.md` §B names
 * ownership and organization deletion as high-risk in so many words.
 *
 * Every test below is therefore the forged request rather than a rendered
 * screen: an authorized owner, holding every permission the schema asks for,
 * whose SESSION is the thing that is wrong. Each runs under `SET ROLE
 * authenticated` with a claim set built by the twin, because that is the only
 * way the rule can be exercised at the boundary a real browser reaches.
 *
 * The two properties are varied one at a time on purpose. Assurance and
 * recency are different questions with different answers, and a test that
 * moved both at once could not tell which one refused.
 */

const OWNER = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const SECOND = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const MEMBER = "cccccccc-3333-4333-8333-cccccccccccc";

let twin: DatabaseTwin;
let organizationId = "";

/** Seconds past the recent-proof window — old enough that nothing is close. */
const STALE_SECONDS = Math.floor(RECENT_PROOF_MS / 1000) + 60;

/**
 * `ocade_organization_invites.token_hash` is constrained to `^[0-9a-f]{64}$` —
 * the shape of a SHA-256 digest — so a fixture that reads like a label would be
 * refused by the column before any of these rules ran, and the test would pass
 * for the wrong reason.
 */
const INVITE_HASHES = {
  stale: "a".repeat(64),
  fresh: "b".repeat(64),
  reissued: "c".repeat(64),
};

async function memberId(userId: string): Promise<string> {
  const rows = await twin.asSuperuser<{ id: string }>(
    `select id from public.ocade_organization_members
      where organization_id = '${organizationId}' and user_id = '${userId}'`,
  );
  return rows[0]?.id ?? "";
}

/** Put the organization back the way `beforeAll` left it. */
async function resetOrganization(): Promise<void> {
  await twin.execSuperuser(
    `update public.ocade_organization_members
        set role = case user_id
              when '${OWNER}' then 'owner'
              when '${SECOND}' then 'admin'
              else 'member' end,
            state = 'active'
      where organization_id = '${organizationId}'`,
  );
  await twin.execSuperuser(
    `delete from auth.mfa_factors where user_id in ('${OWNER}', '${SECOND}', '${MEMBER}')`,
  );
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
    [OWNER, "owner@example.com"],
    [SECOND, "second@example.com"],
    [MEMBER, "member@example.com"],
  ]) {
    await twin.execSuperuser(
      `insert into auth.users (id, email) values ('${id}', '${email}')
       on conflict (id) do nothing`,
    );
  }

  const made = await twin.asTenant<{ ocade_create_organization: string }>(
    OWNER,
    `select public.ocade_create_organization('Ridgeline', 'ridgeline')`,
  );
  expect(made.error, "the organization could not be created").toBeUndefined();
  organizationId = made.rows[0]?.ocade_create_organization ?? "";
  expect(organizationId).not.toEqual("");

  await twin.execSuperuser(
    `insert into public.ocade_organization_members (organization_id, user_id, role, state)
     values ('${organizationId}', '${SECOND}', 'admin', 'active'),
            ('${organizationId}', '${MEMBER}', 'member', 'active')`,
  );
});

afterAll(async () => {
  await twin?.close();
});

describe("the window is one number, not two", () => {
  it("the database and the TypeScript rule agree on how long a proof lasts", async () => {
    const rows = await twin.asSuperuser<{ seconds: number }>(
      `select extract(epoch from public.ocade_recent_proof_window()) as seconds`,
    );
    expect(Number(rows[0]?.seconds) * 1000).toEqual(RECENT_PROOF_MS);
  });
});

describe("a stale session cannot destroy a workspace", () => {
  it("refuses to delete an organization when the last proof is old", async () => {
    const attempt = await twin.asTenant(
      OWNER,
      `select public.ocade_delete_organization('${organizationId}', 'Ridgeline')`,
      { provedSecondsAgo: STALE_SECONDS },
    );
    expect(attempt.error, "a stale session deleted an organization").toMatch(/Confirm it is you/i);

    const survived = await twin.asSuperuser<{ count: string }>(
      `select count(*) from public.ocade_organizations where id = '${organizationId}'`,
    );
    expect(Number(survived[0]?.count)).toEqual(1);
  });

  it("allows the same owner through once they have proved who they are", async () => {
    // Against a throwaway organization, so the fixture the rest of the file
    // depends on is not the thing being deleted.
    const made = await twin.asTenant<{ ocade_create_organization: string }>(
      OWNER,
      `select public.ocade_create_organization('Ridgeline Archive', 'ridgeline-archive')`,
    );
    const throwaway = made.rows[0]?.ocade_create_organization ?? "";
    expect(throwaway).not.toEqual("");

    const attempt = await twin.asTenant(
      OWNER,
      `select public.ocade_delete_organization('${throwaway}', 'Ridgeline Archive')`,
      { provedSecondsAgo: 5 },
    );
    expect(attempt.error, "a fresh, authorized owner was refused").toBeUndefined();

    const gone = await twin.asSuperuser<{ count: string }>(
      `select count(*) from public.ocade_organizations where id = '${throwaway}'`,
    );
    expect(Number(gone[0]?.count)).toEqual(0);
  });

  it("treats a token with no authentication-methods list as not recent", async () => {
    const attempt = await twin.asTenant(
      OWNER,
      `select public.ocade_delete_organization('${organizationId}', 'Ridgeline')`,
      { omitAmr: true },
    );
    expect(attempt.error, "an unknown proof time was treated as recent").toMatch(
      /Confirm it is you/i,
    );
  });

  it("does not accept a proof dated in the future", async () => {
    const attempt = await twin.asTenant(
      OWNER,
      `select public.ocade_delete_organization('${organizationId}', 'Ridgeline')`,
      { provedSecondsAgo: -3_600 },
    );
    expect(attempt.error, "a skewed clock was a way past the check").toMatch(/Confirm it is you/i);
  });
});

describe("an enrolled account must answer its second factor", () => {
  it("refuses an aal1 session when the account holds a verified factor", async () => {
    await twin.execSuperuser(
      `insert into auth.mfa_factors (user_id, friendly_name, status)
       values ('${OWNER}', 'Authenticator', 'verified')`,
    );

    const attempt = await twin.asTenant(
      OWNER,
      `select public.ocade_transfer_organization_ownership('${organizationId}', '${SECOND}')`,
      { aal: "aal1", provedSecondsAgo: 5 },
    );
    expect(attempt.error, "an enrolled account transferred ownership at aal1").toMatch(
      /authenticator app/i,
    );

    const unchanged = await twin.asSuperuser<{ role: string }>(
      `select role from public.ocade_organization_members
        where organization_id = '${organizationId}' and user_id = '${SECOND}'`,
    );
    expect(unchanged[0]?.role).toEqual("admin");

    await resetOrganization();
  });

  it("does not count an unverified enrollment, which anybody can abandon", async () => {
    await twin.execSuperuser(
      `insert into auth.mfa_factors (user_id, friendly_name, status)
       values ('${OWNER}', 'Half-finished setup', 'unverified')`,
    );

    const attempt = await twin.asTenant(
      OWNER,
      `select public.ocade_remove_organization_member('${await memberId(MEMBER)}')`,
      { aal: "aal1", provedSecondsAgo: 5 },
    );
    expect(attempt.error, "an abandoned setup became a permanent refusal").toBeUndefined();

    await twin.execSuperuser(
      `insert into public.ocade_organization_members (organization_id, user_id, role, state)
       values ('${organizationId}', '${MEMBER}', 'member', 'active')`,
    );
    await resetOrganization();
  });

  it("lets an enrolled account through once the factor has been answered", async () => {
    await twin.execSuperuser(
      `insert into auth.mfa_factors (user_id, friendly_name, status)
       values ('${OWNER}', 'Authenticator', 'verified')`,
    );

    const attempt = await twin.asTenant(
      OWNER,
      `select public.ocade_transfer_organization_ownership('${organizationId}', '${SECOND}')`,
      { aal: "aal2", provedSecondsAgo: 5 },
    );
    expect(attempt.error, "an assured, recent owner was refused").toBeUndefined();

    const promoted = await twin.asSuperuser<{ role: string }>(
      `select role from public.ocade_organization_members
        where organization_id = '${organizationId}' and user_id = '${SECOND}'`,
    );
    expect(promoted[0]?.role).toEqual("owner");

    await resetOrganization();
  });

  it("still demands recency from a session that answered its factor this morning", async () => {
    await twin.execSuperuser(
      `insert into auth.mfa_factors (user_id, friendly_name, status)
       values ('${OWNER}', 'Authenticator', 'verified')`,
    );

    const attempt = await twin.asTenant(
      OWNER,
      `select public.ocade_transfer_organization_ownership('${organizationId}', '${SECOND}')`,
      { aal: "aal2", provedSecondsAgo: STALE_SECONDS },
    );
    expect(attempt.error, "assurance was mistaken for recency").toMatch(/Confirm it is you/i);

    await resetOrganization();
  });
});

describe("changing what somebody else may do", () => {
  it("refuses a role change from a stale session", async () => {
    const attempt = await twin.asTenant(
      OWNER,
      `select public.ocade_set_organization_member_role('${await memberId(MEMBER)}', 'admin')`,
      { provedSecondsAgo: STALE_SECONDS },
    );
    expect(attempt.error, "a stale session promoted somebody").toMatch(/Confirm it is you/i);

    const unchanged = await twin.asSuperuser<{ role: string }>(
      `select role from public.ocade_organization_members
        where organization_id = '${organizationId}' and user_id = '${MEMBER}'`,
    );
    expect(unchanged[0]?.role).toEqual("member");
  });

  it("does not ask for a fresh proof when the role is already what was asked for", async () => {
    // A no-op that demanded a factor challenge would train people to answer
    // one for nothing, which is how a security prompt stops being read.
    const attempt = await twin.asTenant<{ ocade_set_organization_member_role: number }>(
      OWNER,
      `select public.ocade_set_organization_member_role('${await memberId(MEMBER)}', 'member')`,
      { provedSecondsAgo: STALE_SECONDS },
    );
    expect(attempt.error).toBeUndefined();
    expect(attempt.rows[0]?.ocade_set_organization_member_role).toEqual(0);
  });

  it("refuses a removal from a stale session", async () => {
    const attempt = await twin.asTenant(
      OWNER,
      `select public.ocade_remove_organization_member('${await memberId(MEMBER)}')`,
      { provedSecondsAgo: STALE_SECONDS },
    );
    expect(attempt.error, "a stale session removed somebody").toMatch(/Confirm it is you/i);
  });
});

describe("changing what the organization allows", () => {
  it("refuses a policy change from a stale session", async () => {
    const attempt = await twin.asTenant(
      OWNER,
      `select public.ocade_set_organization_policy(
         '${organizationId}', ARRAY['browser'], ARRAY[]::text[])`,
      { provedSecondsAgo: STALE_SECONDS },
    );
    expect(attempt.error, "a stale session rewrote the organization's policy").toMatch(
      /Confirm it is you/i,
    );

    const untouched = await twin.asSuperuser<{ count: string }>(
      `select count(*) from public.ocade_organization_policies
        where organization_id = '${organizationId}'`,
    );
    expect(Number(untouched[0]?.count)).toEqual(0);
  });

  it("does not ask when the policy is saved unaltered", async () => {
    // Set it fresh, then save the same thing from a stale session. An
    // administrator pressing Save on an unchanged form should not be asked to
    // answer a factor challenge for nothing.
    const set = await twin.asTenant(
      OWNER,
      `select public.ocade_set_organization_policy(
         '${organizationId}', ARRAY['browser'], ARRAY[]::text[])`,
      { provedSecondsAgo: 5 },
    );
    expect(set.error).toBeUndefined();

    const again = await twin.asTenant<{ ocade_set_organization_policy: number }>(
      OWNER,
      `select public.ocade_set_organization_policy(
         '${organizationId}', ARRAY['browser'], ARRAY[]::text[])`,
      { provedSecondsAgo: STALE_SECONDS },
    );
    expect(again.error).toBeUndefined();
    expect(again.rows[0]?.ocade_set_organization_policy).toEqual(0);

    await twin.execSuperuser(
      `delete from public.ocade_organization_policies where organization_id = '${organizationId}'`,
    );
  });
});

describe("a stale session cannot hand out access", () => {
  it("refuses to invite an address when the last proof is old", async () => {
    const attempt = await twin.asTenant(
      OWNER,
      `select public.ocade_invite_to_organization(
         '${organizationId}', 'stranger@example.com', 'owner',
         '${INVITE_HASHES.stale}', now() + interval '7 days')`,
      { provedSecondsAgo: STALE_SECONDS },
    );
    expect(attempt.error, "a stale session invited an owner").toMatch(/Confirm it is you/i);

    const invited = await twin.asSuperuser<{ count: string }>(
      `select count(*) from public.ocade_organization_invites
        where organization_id = '${organizationId}' and email = 'stranger@example.com'`,
    );
    expect(Number(invited[0]?.count), "the invitation was written anyway").toEqual(0);
  });

  it("invites when the proof is recent", async () => {
    const attempt = await twin.asTenant<{ ocade_invite_to_organization: string }>(
      OWNER,
      `select public.ocade_invite_to_organization(
         '${organizationId}', 'colleague@example.com', 'member',
         '${INVITE_HASHES.fresh}', now() + interval '7 days')`,
      { provedSecondsAgo: 5 },
    );
    expect(attempt.error).toBeUndefined();
    expect(attempt.rows[0]?.ocade_invite_to_organization).toBeTruthy();
  });

  it("refuses to re-issue an invitation link from a stale session", async () => {
    /*
     * The address does not change, so this reads harmless. It is not: the old
     * token stops working and a NEW VALID ONE starts, which is the same
     * capability as issuing the invitation in the first place.
     */
    const invite = await twin.asSuperuser<{ id: string; token_hash: string }>(
      `select id, token_hash from public.ocade_organization_invites
        where organization_id = '${organizationId}' and email = 'colleague@example.com'`,
    );
    const inviteId = invite[0]?.id ?? "";
    expect(inviteId).not.toEqual("");

    const attempt = await twin.asTenant(
      OWNER,
      `select public.ocade_resend_organization_invite(
         '${inviteId}', '${INVITE_HASHES.reissued}', now() + interval '7 days')`,
      { provedSecondsAgo: STALE_SECONDS },
    );
    expect(attempt.error, "a stale session minted a fresh invitation token").toMatch(
      /Confirm it is you/i,
    );

    const after = await twin.asSuperuser<{ token_hash: string }>(
      `select token_hash from public.ocade_organization_invites where id = '${inviteId}'`,
    );
    expect(after[0]?.token_hash, "the token was replaced anyway").toEqual(invite[0]?.token_hash);

    await twin.execSuperuser(
      `delete from public.ocade_organization_invites where organization_id = '${organizationId}'`,
    );
  });

  it("refuses to give a suspended member their access back from a stale session", async () => {
    const member = await memberId(MEMBER);
    await twin.execSuperuser(
      `update public.ocade_organization_members set state = 'deactivated' where id = '${member}'`,
    );

    const attempt = await twin.asTenant(
      OWNER,
      `select public.ocade_set_organization_member_state('${member}', 'active')`,
      { provedSecondsAgo: STALE_SECONDS },
    );
    expect(attempt.error, "a stale session reactivated a suspended member").toMatch(
      /Confirm it is you/i,
    );

    const state = await twin.asSuperuser<{ state: string }>(
      `select state from public.ocade_organization_members where id = '${member}'`,
    );
    expect(state[0]?.state, "the member was reactivated anyway").toEqual("deactivated");

    await resetOrganization();
  });
});

describe("the reversible action stays reachable", () => {
  it("deactivates a member from a stale session, which is the point of it", async () => {
    // Deactivation is what an administrator reaches for when they are unsure,
    // and the one thing somebody locked out of their authenticator still needs
    // to be able to do quickly. It is deliberately not behind the challenge.
    const attempt = await twin.asTenant<{ ocade_set_organization_member_state: number }>(
      OWNER,
      `select public.ocade_set_organization_member_state('${await memberId(MEMBER)}', 'deactivated')`,
      { provedSecondsAgo: STALE_SECONDS },
    );
    expect(attempt.error, "the cautious action was blocked too").toBeUndefined();
    expect(attempt.rows[0]?.ocade_set_organization_member_state).toEqual(1);

    await resetOrganization();
  });
});

describe("the refusal is a refusal, not a server error", () => {
  /**
   * PostgREST turns a `PT403` into HTTP 403 and passes DETAIL through as
   * `details`. That pair is what lets the organization screen offer the right
   * door — a factor challenge or a password — rather than an apology, and a
   * refusal raised without them would arrive as a 500 with prose in it.
   *
   * Captured through a real mutation rather than by calling the guard, because
   * the guard is not granted to `authenticated` and the thing worth proving is
   * that the code survives the SECURITY DEFINER boundary on the way out.
   */
  async function refusalFrom(sql: string, session: Parameters<typeof twin.asTenant>[2]) {
    await twin.execSuperuser(
      `create temp table if not exists assurance_probe (sqlstate text, detail text)`,
    );
    await twin.execSuperuser(`truncate assurance_probe`);
    await twin.execSuperuser(`grant all on assurance_probe to authenticated`);

    const ran = await twin.asTenant(
      OWNER,
      `do $$
       declare captured_state text; captured_detail text;
       begin
         begin
           perform ${sql};
         exception when others then
           get stacked diagnostics
             captured_state = returned_sqlstate,
             captured_detail = pg_exception_detail;
           insert into assurance_probe values (captured_state, captured_detail);
         end;
       end $$`,
      session,
    );
    expect(ran.error).toBeUndefined();
    return twin.asSuperuser<{ sqlstate: string; detail: string }>(
      `select sqlstate, detail from assurance_probe`,
    );
  }

  it("asks for a password when the proof is merely old", async () => {
    const rows = await refusalFrom(
      `public.ocade_delete_organization('${organizationId}', 'Ridgeline')`,
      { provedSecondsAgo: STALE_SECONDS },
    );
    expect(rows[0]?.sqlstate).toEqual("PT403");
    expect(rows[0]?.detail).toEqual("reauthentication_required");
  });

  it("asks for the authenticator code when that is what is missing", async () => {
    await twin.execSuperuser(
      `insert into auth.mfa_factors (user_id, friendly_name, status)
       values ('${OWNER}', 'Authenticator', 'verified')`,
    );
    const rows = await refusalFrom(
      `public.ocade_delete_organization('${organizationId}', 'Ridgeline')`,
      { aal: "aal1", provedSecondsAgo: 5 },
    );
    expect(rows[0]?.sqlstate).toEqual("PT403");
    expect(rows[0]?.detail).toEqual("factor_required");
    await resetOrganization();
  });
});

describe("the helpers are not reachable from a browser", () => {
  it("grants EXECUTE on none of them to anon or authenticated", async () => {
    const rows = await twin.asSuperuser<{ fn: string; grantee: string }>(
      `select p.oid::regprocedure::text as fn, g.grantee, 1 as reachable
         from pg_proc p
         cross join (values ('anon'), ('authenticated')) as g(grantee)
        where p.proname in (
                'ocade_recent_proof_window',
                'ocade_session_has_verified_factor',
                'ocade_session_last_proof_at',
                'ocade_require_recent_strong_auth')
          and has_function_privilege(g.grantee, p.oid, 'EXECUTE')`,
    );
    expect(rows, "a browser role can call the assurance helpers directly").toEqual([]);
  });
});
