import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";

/**
 * THE OWNER AND STAFF CONSOLES ON OCADE.IN, AGAINST REAL POSTGRESQL.
 *
 * Staff authority rides the account's own site session now (20261003090000):
 * live session, second factor answered here, no factor added during this
 * session, recent proof for changes. Owners are never stopped by a usage
 * window; an owner gives anyone else unlimited use until a date or until
 * revoked; usage is recorded either way. Ownership is handed over to an Owner,
 * and the former Primary Owner stays an Owner or leaves, as chosen.
 */
let twin: DatabaseTwin;
const OWNER = "2a2a2a2a-1111-4aaa-8aaa-aaaaaaaaaaaa";
const SECOND = "2b2b2b2b-2222-4bbb-8bbb-bbbbbbbbbbbb";
const ADMIN = "2c2c2c2c-3333-4ccc-8ccc-cccccccccccc";
const CUSTOMER = "2e2e2e2e-5555-4eee-8eee-eeeeeeeeeeee";
const MIGRATION = "20261003090000_owner_and_staff_consoles_on_ocade_in";
const session: Record<string, string> = {};
const WINDOW = "2026-10-03T00:00:00Z";

const newSession = async (user: string) =>
  (
    await twin.asSuperuser<{ id: string }>(
      `insert into auth.sessions (user_id) values ('${user}') returning id`,
    )
  )[0]!.id;

const ask = <T>(user: string, sql: string, aal: "aal1" | "aal2" = "aal2") =>
  // Make the simulated authentication proof unambiguously recent while leaving
  // a small clock-skew margin between the JS runner and the PostgreSQL twin.
  // The database still enforces MFA and rejects missing/stale assurance.
  twin.asTenant<T>(user, sql, { aal, sessionId: session[user], provedSecondsAgo: 30 });

const can = async (user: string, permission: string, aal: "aal1" | "aal2" = "aal2") =>
  (await ask<{ ok: boolean }>(user, `select public.ocade_staff_can('${permission}') as ok`, aal))
    .rows[0]?.ok;

/** One use against a window whose allowance is two, as the server spends it. */
const spend = async (user: string) => {
  try {
    await twin.asServiceRole(
      `select public.ocade_consume_commercial_work('${user}', 'jarvis_session', '${WINDOW}', 100, 200)`,
    );
    return "spent";
  } catch {
    return "refused";
  }
};
const used = async (user: string) =>
  Number(
    (
      await twin.asSuperuser<{ h: string }>(
        `select coalesce(sum(used_hundredths), 0) as h from public.ocade_commercial_usage
          where user_id = '${user}' and window_start = '${WINDOW}'`,
      )
    )[0]!.h,
  );
const resetUsage = () => twin.execSuperuser(`delete from public.ocade_commercial_usage`);
const unlimited = async (user: string) =>
  (
    await twin.asServiceRole<{ why: string }>(
      `select why from public.ocade_account_unlimited('${user}')`,
    )
  )[0]?.why ?? null;

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(applied.filter((m) => !m.ok)).toEqual([]);
  await twin.execSuperuser(
    `insert into auth.users (id, email, email_confirmed_at) values
       ('${OWNER}', 'owner@ocade.test', now()), ('${SECOND}', 'second@ocade.test', now()),
       ('${ADMIN}', 'admin@ocade.test', now()), ('${CUSTOMER}', 'c@ocade.test', now())
       on conflict do nothing;
     insert into public.ocade_staff (user_id, role) values
       ('${OWNER}', 'primary_owner'), ('${SECOND}', 'backup_owner'), ('${ADMIN}', 'admin')
       on conflict do nothing;
     insert into public.profiles (id, email) values
       ('${OWNER}', 'owner@ocade.test'), ('${SECOND}', 'second@ocade.test'),
       ('${ADMIN}', 'admin@ocade.test'), ('${CUSTOMER}', 'c@ocade.test')
       on conflict (id) do nothing;`,
  );
  for (const user of [OWNER, SECOND, ADMIN, CUSTOMER]) session[user] = await newSession(user);
  await twin.execSuperuser(`update auth.sessions set created_at = now() - interval '1 hour'`);
}, 240_000);

afterAll(async () => {
  await twin?.close();
});

describe("staff authority on the site's own session", () => {
  it("a staff member's ocade.in session operates, a customer's never does", async () => {
    expect(await can(ADMIN, "customers.read")).toBe(true);
    expect(await can(CUSTOMER, "customers.read")).toBe(false);
    const legacy = await ask<{ r: boolean }>(
      ADMIN,
      `select public.has_role('${ADMIN}'::uuid, 'admin'::public.app_role) as r`,
    );
    expect(legacy.rows[0]!.r).toBe(true);
    const read = await ask(ADMIN, `select id from public.profiles where id = '${CUSTOMER}'`);
    expect(read.rows).toHaveLength(1);
    expect(
      (await ask(CUSTOMER, `select id from public.profiles where id = '${ADMIN}'`)).rows,
    ).toHaveLength(0);
  });

  it("without the second factor in this session staff read nothing; the Primary Owner only looks", async () => {
    expect(await can(ADMIN, "customers.read", "aal1")).toBe(false);
    expect(await can(OWNER, "customers.read", "aal1")).toBe(true);
    const change = await ask(
      OWNER,
      `select public.ocade_set_service_control('jarvis_execution', true, 'Without a second factor')`,
      "aal1",
    );
    expect(change.errorCode).toBe("42501");
  });

  it("an ended session is no longer staff, though its token is still signed", async () => {
    const ended = await newSession(ADMIN);
    await twin.execSuperuser(`delete from auth.sessions where id = '${ended}'`);
    const after = await twin.asTenant<{ ok: boolean }>(
      ADMIN,
      `select public.ocade_staff_can('customers.read') as ok`,
      { aal: "aal2", sessionId: ended },
    );
    expect(after.rows[0]!.ok).toBe(false);
  });

  it("a factor enrolled during this session gives no staff authority until the next sign-in", async () => {
    const [{ id: factor }] = await twin.asSuperuser<{ id: string }>(
      `insert into auth.mfa_factors (user_id, status) values ('${ADMIN}', 'verified') returning id`,
    );
    expect(await can(ADMIN, "customers.read")).toBe(false);
    const legacy = await ask<{ r: boolean }>(
      ADMIN,
      `select public.has_role('${ADMIN}'::uuid, 'admin'::public.app_role) as r`,
    );
    expect(legacy.rows[0]!.r).toBe(false);
    // Signed in again after the factor: staff again.
    const before = session[ADMIN]!;
    session[ADMIN] = await newSession(ADMIN);
    expect(await can(ADMIN, "customers.read")).toBe(true);
    session[ADMIN] = before;
    await twin.execSuperuser(`delete from auth.mfa_factors where id = '${factor}'`);
  });

  it("the retired console origin left no session table behind", async () => {
    const gone = await twin.asSuperuser<{ t: string | null }>(
      `select to_regclass('public.ocade_console_sessions')::text as t`,
    );
    expect(gone[0]!.t).toBeNull();
  });

  it("removing a staff role takes effect on the very next request", async () => {
    await twin.execSuperuser(
      `insert into auth.users (id, email, email_confirmed_at)
       values ('2d2d2d2d-4444-4ddd-8ddd-dddddddddddd', 'support@ocade.test', now()) on conflict do nothing;
       insert into public.ocade_staff (user_id, role) values ('2d2d2d2d-4444-4ddd-8ddd-dddddddddddd', 'support')
       on conflict do nothing;`,
    );
    const SUPPORT = "2d2d2d2d-4444-4ddd-8ddd-dddddddddddd";
    session[SUPPORT] = await newSession(SUPPORT);
    expect(await can(SUPPORT, "customers.read")).toBe(true);
    const revoke = await ask(
      OWNER,
      `select public.ocade_staff_revoke('${SUPPORT}', 'Left the support team today')`,
    );
    expect(revoke.error).toBeUndefined();
    expect(await can(SUPPORT, "customers.read")).toBe(false);
    expect((await ask(SUPPORT, `select * from public.ocade_my_staff()`)).rows).toHaveLength(0);
  });
});

describe("unlimited use", () => {
  it("owners are never stopped, and every use is still recorded", async () => {
    await resetUsage();
    for (const user of [OWNER, SECOND]) {
      expect([await spend(user), await spend(user), await spend(user)]).toEqual([
        "spent",
        "spent",
        "spent",
      ]);
      expect(await used(user)).toBe(300);
      expect(await unlimited(user)).toBe("owner");
    }
    expect([await spend(CUSTOMER), await spend(CUSTOMER), await spend(CUSTOMER)]).toEqual([
      "spent",
      "spent",
      "refused",
    ]);
    expect(await used(CUSTOMER)).toBe(200);
    expect(await unlimited(CUSTOMER)).toBeNull();
  });

  it("an owner gives a customer unlimited use until a date, then revokes it; limits return at once", async () => {
    await resetUsage();
    await spend(CUSTOMER);
    await spend(CUSTOMER);
    expect(await spend(CUSTOMER)).toBe("refused");
    const give = await ask<{ id: string }>(
      SECOND,
      `select public.ocade_grant_unlimited('${CUSTOMER}', now() + interval '2 days', 'Mobile test account for the matrix') as id`,
    );
    expect(give.error).toBeUndefined();
    expect(await unlimited(CUSTOMER)).toBe("grant");
    expect(await spend(CUSTOMER)).toBe("spent");
    expect(await used(CUSTOMER)).toBe(300);
    const audit = await twin.asSuperuser<{ action: string; reason: string }>(
      `select action, reason from public.ocade_admin_actions
        where target_user = '${CUSTOMER}' order by created_at desc limit 1`,
    );
    expect(audit[0]).toEqual(
      expect.objectContaining({
        action: "unlimited_granted",
        reason: expect.stringMatching(/until 20/),
      }),
    );
    const take = await ask<{ ok: boolean }>(
      SECOND,
      `select public.ocade_revoke_unlimited('${CUSTOMER}', 'The matrix run has finished') as ok`,
    );
    expect(take.rows[0]!.ok).toBe(true);
    expect(await unlimited(CUSTOMER)).toBeNull();
    expect(await spend(CUSTOMER)).toBe("refused");
    const again = await ask<{ ok: boolean }>(
      SECOND,
      `select public.ocade_revoke_unlimited('${CUSTOMER}', 'The matrix run has finished') as ok`,
    );
    expect(again.rows[0]!.ok).toBe(false);
  });

  it("until revoked has no end; a grant past its end is over by itself", async () => {
    await resetUsage();
    await ask(
      OWNER,
      `select public.ocade_grant_unlimited('${ADMIN}', null, 'Staff member needs room this month')`,
    );
    expect(await unlimited(ADMIN)).toBe("grant");
    await twin.execSuperuser(
      `update public.ocade_unlimited_grants set created_at = now() - interval '2 days',
              ends_at = now() - interval '1 minute' where user_id = '${ADMIN}' and revoked_at is null`,
    );
    expect(await unlimited(ADMIN)).toBeNull();
    await spend(ADMIN);
    await spend(ADMIN);
    expect(await spend(ADMIN)).toBe("refused");
    // A new grant replaces the lapsed one rather than colliding with it.
    const give = await ask(
      OWNER,
      `select public.ocade_grant_unlimited('${ADMIN}', null, 'Staff member needs room again')`,
    );
    expect(give.error).toBeUndefined();
    expect(await unlimited(ADMIN)).toBe("grant");
    await ask(
      OWNER,
      `select public.ocade_revoke_unlimited('${ADMIN}', 'Back to the normal limits')`,
    );
  });

  it("only an owner gives it, never to themselves, with a recent code and a reason", async () => {
    const byAdmin = await ask(
      ADMIN,
      `select public.ocade_grant_unlimited('${CUSTOMER}', null, 'Admin trying to give unlimited')`,
    );
    expect(byAdmin.errorCode).toBe("42501");
    const byCustomer = await ask(
      CUSTOMER,
      `select public.ocade_grant_unlimited('${CUSTOMER}', null, 'Customer trying to give unlimited')`,
    );
    expect(byCustomer.errorCode).toBe("42501");
    const self = await ask(
      SECOND,
      `select public.ocade_grant_unlimited('${SECOND}', null, 'Granting myself just in case')`,
    );
    expect(self.errorCode).toBe("42501");
    const stale = await twin.asTenant(
      SECOND,
      `select public.ocade_grant_unlimited('${CUSTOMER}', null, 'Code answered long ago')`,
      { aal: "aal2", sessionId: session[SECOND], provedSecondsAgo: 3600 },
    );
    expect(stale.error).toBeDefined();
    const why = await ask(
      SECOND,
      `select public.ocade_grant_unlimited('${CUSTOMER}', null, 'short')`,
    );
    expect(why.errorCode).toBe("22023");
    const past = await ask(
      SECOND,
      `select public.ocade_grant_unlimited('${CUSTOMER}', now() - interval '1 day', 'An end in the past')`,
    );
    expect(past.errorCode).toBe("22023");
    // Nobody reads or writes the grants around the functions.
    expect((await ask(OWNER, `select * from public.ocade_unlimited_grants`)).errorCode).toBe(
      "42501",
    );
    expect(
      (await ask(CUSTOMER, `select * from public.ocade_account_unlimited('${CUSTOMER}')`))
        .errorCode,
    ).toBe("42501");
  });
});

describe("handing over ownership", () => {
  it("locks both Owners and requires exactly one Primary Owner at the end (P05)", async () => {
    const verify = await twin.runScript(
      "supabase/verification",
      "20261011090000_ownership_transfer_locks_both_owners_verify.sql",
    );
    expect(verify.error).toBeUndefined();
  });

  it("goes only to an Owner, leaves exactly one Primary Owner, and the former one stays an Owner", async () => {
    const toAdmin = await ask(
      OWNER,
      `select public.ocade_staff_transfer_ownership('${ADMIN}', 'Handing over to an admin')`,
    );
    expect(toAdmin.errorCode).toBe("22023");
    const bySecond = await ask(
      SECOND,
      `select public.ocade_staff_transfer_ownership('${SECOND}', 'Taking ownership for myself')`,
    );
    expect(bySecond.errorCode).toBe("42501");
    const done = await ask(
      OWNER,
      `select public.ocade_staff_transfer_ownership('${SECOND}', 'Planned hand-over to the new owner')`,
    );
    expect(done.error).toBeUndefined();
    const roles = await twin.asSuperuser<{ user_id: string; role: string }>(
      `select user_id, role from public.ocade_staff where role in ('primary_owner', 'backup_owner') order by role`,
    );
    expect(roles).toEqual([
      { user_id: OWNER, role: "backup_owner" },
      { user_id: SECOND, role: "primary_owner" },
    ]);
    expect(await unlimited(OWNER)).toBe("owner");
  });

  it("the former Primary Owner may leave the staff as part of the hand-over, never leaving none", async () => {
    const back = await ask(
      SECOND,
      `select public.ocade_staff_transfer_ownership('${OWNER}', 'Handing back, and leaving the staff', false)`,
    );
    expect(back.error).toBeUndefined();
    const roles = await twin.asSuperuser<{ user_id: string; role: string }>(
      `select user_id, role from public.ocade_staff where role in ('primary_owner', 'backup_owner')`,
    );
    expect(roles).toEqual([{ user_id: OWNER, role: "primary_owner" }]);
    expect(await can(SECOND, "customers.read")).toBe(false);
    expect(await unlimited(SECOND)).toBeNull();
    // The Primary Owner cannot be removed or demoted by an ordinary control.
    const revoke = await ask(
      OWNER,
      `select public.ocade_staff_revoke('${OWNER}', 'Removing myself by accident')`,
    );
    expect(revoke.errorCode).toBe("42501");
    await twin.execSuperuser(
      `insert into public.ocade_staff (user_id, role) values ('${SECOND}', 'backup_owner')`,
    );
  });
});

describe("rolled back and applied again", () => {
  it("undoes cleanly and verifies after reapplying", async () => {
    const undo = await twin.runScript("supabase/rollback", `${MIGRATION}_rollback.sql`);
    expect(undo.error).toBeUndefined();
    await resetUsage();
    await spend(OWNER);
    await spend(OWNER);
    expect(await spend(OWNER)).toBe("refused");
    expect((await twin.runScript("supabase/migrations", `${MIGRATION}.sql`)).error).toBeUndefined();
    expect(
      (await twin.runScript("supabase/verification", `${MIGRATION}_verify.sql`)).error,
    ).toBeUndefined();
    expect(await spend(OWNER)).toBe("spent");
  });
});
