import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";

/**
 * STAFF AUTHORITY LIVES IN THE CONSOLE'S OWN SESSION, AGAINST REAL POSTGRESQL.
 *
 * The same staff account has two sessions: the one ocade.in uses for Chat and
 * JARVIS, and the one admin.ocade.in opened for itself. Only the second may
 * operate — so a token lifted from the customer site is not a staff token.
 */
let twin: DatabaseTwin;
const OWNER = "1a1a1a1a-1111-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN = "1c1c1c1c-3333-4ccc-8ccc-cccccccccccc";
const CUSTOMER = "1e1e1e1e-5555-4eee-8eee-eeeeeeeeeeee";
const MIGRATION = "20261001090000_staff_authority_only_in_the_console";
const sessions: Record<string, { site: string; console: string }> = {};

const newSession = async (user: string) =>
  (
    await twin.asSuperuser<{ id: string }>(
      `insert into auth.sessions (user_id) values ('${user}') returning id`,
    )
  )[0]!.id;

const ask = async <T>(user: string, sql: string, where: "site" | "console", aal = "aal2") =>
  twin.asTenant<T>(user, sql, {
    aal: aal as "aal1" | "aal2",
    sessionId: sessions[user]![where],
  });

const can = async (user: string, permission: string, where: "site" | "console", aal = "aal2") =>
  (
    await ask<{ ok: boolean }>(
      user,
      `select public.ocade_staff_can('${permission}') as ok`,
      where,
      aal,
    )
  ).rows[0]?.ok;

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(applied.filter((m) => !m.ok)).toEqual([]);
  await twin.execSuperuser(
    `insert into auth.users (id, email, email_confirmed_at) values
       ('${OWNER}', 'owner@ocade.test', now()), ('${ADMIN}', 'admin@ocade.test', now()),
       ('${CUSTOMER}', 'c@ocade.test', now()) on conflict do nothing;
     insert into public.ocade_staff (user_id, role) values
       ('${OWNER}', 'primary_owner'), ('${ADMIN}', 'admin') on conflict do nothing;
     insert into public.profiles (id, email) values ('${CUSTOMER}', 'c@ocade.test')
       on conflict (id) do nothing;`,
  );
  for (const user of [OWNER, ADMIN]) {
    sessions[user] = { site: await newSession(user), console: await newSession(user) };
    await twin.execSuperuser(
      `insert into public.ocade_console_sessions (session_id, user_id)
       values ('${sessions[user]!.console}', '${user}')`,
    );
  }
}, 240_000);

afterAll(async () => {
  await twin?.close();
});

describe("staff authority belongs to the console's session", () => {
  it("the customer-site session of a staff account is not staff, even with its second factor", async () => {
    expect(await can(ADMIN, "customers.read", "site")).toBe(false);
    expect(await can(ADMIN, "customers.read", "console")).toBe(true);
    const change = await ask(
      ADMIN,
      `select public.ocade_set_service_control('jarvis_execution', true, 'From the customer site session')`,
      "site",
    );
    expect(change.errorCode).toBe("42501");
  });

  it("the older policies follow it: another account's profile only from the console", async () => {
    const read = (where: "site" | "console") =>
      ask(ADMIN, `select id from public.profiles where id = '${CUSTOMER}'`, where);
    expect((await read("site")).rows).toHaveLength(0);
    expect((await read("console")).rows).toHaveLength(1);
    const legacy = (where: "site" | "console") =>
      ask<{ r: boolean }>(
        ADMIN,
        `select public.has_role('${ADMIN}'::uuid, 'admin'::public.app_role) as r`,
        where,
      );
    expect((await legacy("site")).rows[0]!.r).toBe(false);
    expect((await legacy("console")).rows[0]!.r).toBe(true);
  });

  it("a console session still answers its own second factor before it may operate", async () => {
    expect(await can(ADMIN, "customers.read", "console", "aal1")).toBe(false);
    // The Primary Owner may look while setting two-step up, and never change.
    expect(await can(OWNER, "customers.read", "console", "aal1")).toBe(true);
    const change = await ask(
      OWNER,
      `select public.ocade_set_service_control('jarvis_execution', true, 'Without a second factor')`,
      "console",
      "aal1",
    );
    expect(change.errorCode).toBe("42501");
  });

  it("the site session still knows it is staff, so it can offer the way in", async () => {
    const mine = await ask<{ role: string }>(
      ADMIN,
      `select * from public.ocade_my_staff()`,
      "site",
    );
    expect(mine.rows).toEqual([expect.objectContaining({ role: "admin" })]);
  });

  it("no browser session records itself as a console session", async () => {
    const own = await twin.asTenant(
      ADMIN,
      `insert into public.ocade_console_sessions (session_id, user_id)
       values ('${sessions[ADMIN]!.site}', '${ADMIN}')`,
      { aal: "aal2", sessionId: sessions[ADMIN]!.site },
    );
    expect(own.errorCode).toBe("42501");
    const read = await twin.asTenant(ADMIN, `select * from public.ocade_console_sessions`, {
      aal: "aal2",
      sessionId: sessions[ADMIN]!.console,
    });
    expect(read.errorCode).toBe("42501");
    expect(await can(ADMIN, "customers.read", "site")).toBe(false);
  });

  it("another account's console session is not yours", async () => {
    const borrowed = await twin.asTenant<{ ok: boolean }>(
      ADMIN,
      `select public.ocade_staff_can('customers.read') as ok`,
      { aal: "aal2", sessionId: sessions[OWNER]!.console },
    );
    expect(borrowed.rows[0]!.ok).toBe(false);
  });

  it("ending the console session ends its authority and its record", async () => {
    const ended = await newSession(ADMIN);
    await twin.execSuperuser(
      `insert into public.ocade_console_sessions (session_id, user_id) values ('${ended}', '${ADMIN}');
       delete from auth.sessions where id = '${ended}'`,
    );
    const left = await twin.asSuperuser(
      `select 1 from public.ocade_console_sessions where session_id = '${ended}'`,
    );
    expect(left).toHaveLength(0);
    const after = await twin.asTenant<{ ok: boolean }>(
      ADMIN,
      `select public.ocade_staff_can('customers.read') as ok`,
      { aal: "aal2", sessionId: ended },
    );
    expect(after.rows[0]!.ok).toBe(false);
  });
});

describe("a factor added after signing in counts only after the next sign-in", () => {
  it("a stolen session cannot enroll its own authenticator into staff authority or recent proof", async () => {
    const S = sessions[ADMIN]!;
    await twin.execSuperuser(
      `update auth.sessions set created_at = now() - interval '1 hour'
        where id in ('${S.site}', '${S.console}')`,
    );
    const mutate = (where: "site" | "console") =>
      ask(
        ADMIN,
        `select public.ocade_set_service_control('jarvis_execution', false, 'A fresh console session works')`,
        where,
      );
    expect(await can(ADMIN, "customers.read", "console")).toBe(true);

    // Enrolled from the stolen site session, not yet answered.
    const [{ id: factor }] = await twin.asSuperuser<{ id: string }>(
      `insert into auth.mfa_factors (user_id, status) values ('${ADMIN}', 'unverified') returning id`,
    );
    const since = async (unverifiedToo: boolean) =>
      (
        await ask<{ newer: boolean }>(
          ADMIN,
          `select public.ocade_factor_added_since_sign_in(${unverifiedToo}) as newer`,
          "site",
        )
      ).rows[0]!.newer;
    // The hand-over to the console refuses even one merely started.
    expect(await since(true)).toBe(true);
    expect(await since(false)).toBe(false);

    // Answered: the sessions it is newer than lose the console and recent proof.
    await twin.execSuperuser(
      `update auth.mfa_factors set status = 'verified' where id = '${factor}'`,
    );
    const setUpHere = async () =>
      (
        await ask<{ here: boolean }>(
          ADMIN,
          `select public.ocade_two_step_set_up_in_this_sign_in() as here`,
          "site",
        )
      ).rows[0]!.here;
    // The account's only factor, set up in this sign-in: nothing older was got round.
    expect(await setUpHere()).toBe(true);
    const [{ id: older }] = await twin.asSuperuser<{ id: string }>(
      `insert into auth.mfa_factors (user_id, status, created_at)
       values ('${ADMIN}', 'verified', now() - interval '2 hours') returning id`,
    );
    // With a factor older than the sign-in, the newer one is somebody adding a second.
    expect(await setUpHere()).toBe(false);
    await twin.execSuperuser(`delete from auth.mfa_factors where id = '${older}'`);
    expect(await can(ADMIN, "customers.read", "console")).toBe(false);
    expect((await mutate("console")).errorCode).toBe("42501");
    // Every staff change and high-risk action asks this, from a definer like this one.
    await twin.execSuperuser(
      `create function public.ocade_test_recent() returns void language sql security definer
         set search_path to '' as $$ select public.ocade_require_recent_strong_auth('testing') $$;
       grant execute on function public.ocade_test_recent() to authenticated;`,
    );
    const recent = await ask(ADMIN, `select public.ocade_test_recent()`, "site");
    await twin.execSuperuser(`drop function public.ocade_test_recent()`);
    expect(recent.errorCode, recent.error).toBe("PT403");
    expect(recent.error).toMatch(/after signing in here\. Sign in again/);

    // A console session that began after the factor is the console's again.
    const fresh = await newSession(ADMIN);
    await twin.execSuperuser(
      `insert into public.ocade_console_sessions (session_id, user_id) values ('${fresh}', '${ADMIN}')`,
    );
    sessions[ADMIN] = { site: S.site, console: fresh };
    expect(await can(ADMIN, "customers.read", "console")).toBe(true);
    expect((await mutate("console")).error).toBeUndefined();
    sessions[ADMIN] = S;
    await twin.execSuperuser(`delete from auth.mfa_factors where id = '${factor}'`);
  });
});

describe("rolled back and applied again", () => {
  it("undoes cleanly and verifies after reapplying", async () => {
    const undo = await twin.runScript("supabase/rollback", `${MIGRATION}_rollback.sql`);
    expect(undo.error).toBeUndefined();
    expect(await can(ADMIN, "customers.read", "site")).toBe(true);
    expect((await twin.runScript("supabase/migrations", `${MIGRATION}.sql`)).error).toBeUndefined();
    expect(
      (await twin.runScript("supabase/verification", `${MIGRATION}_verify.sql`)).error,
    ).toBeUndefined();
    expect(await can(ADMIN, "customers.read", "site")).toBe(false);
  });
});
