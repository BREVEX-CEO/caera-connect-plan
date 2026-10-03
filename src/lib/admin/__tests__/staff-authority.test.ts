import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";

/**
 * ONE STAFF AUTHORITY, AGAINST REAL POSTGRESQL AND THE REAL MIGRATIONS.
 *
 * Primary Owner, Backup Owner, Admin, Support and two customers. Every rule a
 * browser could try to get around is tried here as that browser's role:
 * escalation, self-grants, reading without a second factor, touching an owner,
 * reading a customer's conversation without a live case.
 */
let twin: DatabaseTwin;
const OWNER = "0a0a0a0a-1111-4aaa-8aaa-aaaaaaaaaaaa";
const BACKUP = "0b0b0b0b-2222-4bbb-8bbb-bbbbbbbbbbbb";
const ADMIN = "0c0c0c0c-3333-4ccc-8ccc-cccccccccccc";
const SUPPORT = "0d0d0d0d-4444-4ddd-8ddd-dddddddddddd";
const CUSTOMER_A = "0e0e0e0e-5555-4eee-8eee-eeeeeeeeeeee";
const CUSTOMER_B = "0f0f0f0f-6666-4fff-8fff-ffffffffffff";
const fresh = { aal: "aal2" as const };

const staff = async (user: string) =>
  (
    await twin.asServiceRole<{ role: string }>(
      `select role from public.ocade_staff where user_id = '${user}'`,
    )
  )[0]?.role ?? null;

const can = async (user: string, permission: string, aal: "aal1" | "aal2" = "aal2") =>
  (
    await twin.asTenant<{ ok: boolean }>(
      user,
      `select public.ocade_staff_can('${permission}') as ok`,
      { aal },
    )
  ).rows[0]?.ok;

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(applied.filter((m) => !m.ok)).toEqual([]);
  await twin.execSuperuser(
    `insert into auth.users (id, email, email_confirmed_at) values
       ('${OWNER}', 'owner@ocade.test', now()), ('${BACKUP}', 'backup@ocade.test', now()),
       ('${ADMIN}', 'admin@ocade.test', now()), ('${SUPPORT}', 'support@ocade.test', now()),
       ('${CUSTOMER_A}', 'a@ocade.test', now()), ('${CUSTOMER_B}', 'b@ocade.test', now())
     on conflict do nothing;`,
  );
}, 240_000);

afterAll(async () => {
  await twin?.close();
});

beforeEach(async () => {
  await twin.execSuperuser(
    `delete from public.ocade_staff; delete from public.ocade_staff_invites;
     delete from public.ocade_support_cases; delete from public.ocade_admin_actions;
     insert into public.ocade_staff (user_id, role) values
       ('${OWNER}', 'primary_owner'), ('${BACKUP}', 'backup_owner'),
       ('${ADMIN}', 'admin'), ('${SUPPORT}', 'support');`,
  );
});

describe("the migration", () => {
  it("passes its verification script", async () => {
    const result = await twin.runScript(
      "supabase/verification",
      "20260930093000_one_staff_authority_verify.sql",
    );
    expect(result.error).toBeUndefined();
  });

  it("allows only one Primary Owner", async () => {
    await expect(
      twin.execSuperuser(
        `update public.ocade_staff set role = 'primary_owner' where user_id = '${ADMIN}'`,
      ),
    ).rejects.toThrow();
  });
});

describe("the first Primary Owner", () => {
  it("is named only by the service role, and only while there is none", async () => {
    await twin.execSuperuser(`delete from public.ocade_staff where role = 'primary_owner'`);
    const asPerson = await twin.asTenant(
      CUSTOMER_A,
      `select public.ocade_bootstrap_primary_owner('a@ocade.test')`,
      fresh,
    );
    expect(asPerson.errorCode).toBe("42501");
    const [named] = await twin.asServiceRole<{ id: string }>(
      `select public.ocade_bootstrap_primary_owner('OWNER@ocade.test') as id`,
    );
    expect(named!.id).toBe(OWNER);
    await expect(
      twin.asServiceRole(`select public.ocade_bootstrap_primary_owner('b@ocade.test')`),
    ).rejects.toThrow(/already has a Primary Owner/);
  });
});

describe("what each role may see", () => {
  it("gives each role its own modules, and customers none", async () => {
    expect(await can(SUPPORT, "customers.read")).toBe(true);
    expect(await can(SUPPORT, "grants.manage")).toBe(false);
    expect(await can(SUPPORT, "staff.manage")).toBe(false);
    expect(await can(ADMIN, "execution.manage")).toBe(true);
    expect(await can(ADMIN, "staff.manage")).toBe(false);
    expect(await can(BACKUP, "staff.manage")).toBe(true);
    expect(await can(CUSTOMER_A, "customers.read")).toBe(false);
  });

  it("needs a second factor this session for everybody but the Primary Owner", async () => {
    expect(await can(SUPPORT, "customers.read", "aal1")).toBe(false);
    expect(await can(OWNER, "customers.read", "aal1")).toBe(true);
  });

  it("applies per-person overrides, and never takes anything from the Primary Owner", async () => {
    await twin.execSuperuser(
      `update public.ocade_staff set granted = '{usage.read}', denied = '{tasks.read}'
        where user_id = '${SUPPORT}'`,
    );
    expect(await can(SUPPORT, "usage.read")).toBe(true);
    expect(await can(SUPPORT, "tasks.read")).toBe(false);
    await expect(
      twin.execSuperuser(
        `update public.ocade_staff set denied = '{audit.read}' where user_id = '${OWNER}'`,
      ),
    ).rejects.toThrow();
    await expect(
      twin.execSuperuser(
        `update public.ocade_staff set granted = '{be.god}' where user_id = '${SUPPORT}'`,
      ),
    ).rejects.toThrow();
  });

  it("shows the role matrix only to whoever manages staff", async () => {
    const matrix = (who: string) =>
      twin.asTenant<{ role: string; permissions: string[] }>(
        who,
        `select * from public.ocade_staff_role_defaults()`,
        fresh,
      );
    const owner = await matrix(OWNER);
    expect(owner.rows.map((row) => row.role).sort()).toEqual([
      "admin",
      "backup_owner",
      "billing",
      "operations",
      "primary_owner",
      "read_only",
      "support",
    ]);
    expect(owner.rows.find((row) => row.role === "support")!.permissions).toEqual([
      "customers.read",
      "devices.read",
      "tasks.read",
      "cases.read",
    ]);
    for (const who of [ADMIN, SUPPORT, CUSTOMER_A]) expect((await matrix(who)).rows).toEqual([]);
    expect((await twin.asAnon(`select * from public.ocade_staff_role_defaults()`)).errorCode).toBe(
      "42501",
    );
  });

  it("tells each person only about themselves", async () => {
    const mine = await twin.asTenant<{ role: string; permissions: string[] }>(
      SUPPORT,
      `select * from public.ocade_my_staff()`,
      fresh,
    );
    expect(mine.rows).toEqual([expect.objectContaining({ role: "support", second_factor: true })]);
    const customer = await twin.asTenant(
      CUSTOMER_A,
      `select * from public.ocade_my_staff()`,
      fresh,
    );
    expect(customer.rows).toEqual([]);
    const direct = await twin.asTenant(SUPPORT, `select * from public.ocade_staff`, fresh);
    expect(direct.errorCode).toBe("42501");
  });

  it("keeps older policies working: has_role admin means an owner or an Admin with their second factor", async () => {
    const ask = async (user: string, aal: "aal1" | "aal2") =>
      (
        await twin.asTenant<{ r: boolean }>(
          user,
          `select public.has_role('${user}'::uuid, 'admin'::public.app_role) as r`,
          { aal },
        )
      ).rows[0]?.r;
    expect(await ask(OWNER, "aal1")).toBe(true);
    expect(await ask(ADMIN, "aal2")).toBe(true);
    expect(await ask(ADMIN, "aal1")).toBe(false);
    expect(await ask(BACKUP, "aal1")).toBe(false);
    expect(await ask(SUPPORT, "aal2")).toBe(false);
    expect(await ask(CUSTOMER_A, "aal2")).toBe(false);
    // The server asks without a session and is answered from the role alone.
    const [server] = await twin.asSuperuser<{ r: boolean }>(
      `select public.has_role('${ADMIN}'::uuid, 'admin'::public.app_role) as r`,
    );
    expect(server!.r).toBe(true);
  });

  it("an Admin's stolen password alone reads no other account through the older policies", async () => {
    await twin.execSuperuser(
      `insert into public.profiles (id, email) values ('${CUSTOMER_A}', 'a@ocade.test')
       on conflict (id) do update set email = excluded.email`,
    );
    const others = (aal: "aal1" | "aal2") =>
      twin.asTenant(ADMIN, `select id from public.profiles where id = '${CUSTOMER_A}'`, { aal });
    expect((await others("aal1")).rows).toHaveLength(0);
    expect((await others("aal2")).rows).toHaveLength(1);
    // Nobody reads every account's manual grants from a browser session any more.
    await twin.execSuperuser(
      `insert into public.ocade_entitlement_grants (user_id, tier, reason, granted_by, starts_at, ends_at)
       values ('${CUSTOMER_B}', 'pro', 'A grant for the policy check', '${OWNER}', now(),
               now() + interval '1 day')`,
    );
    const grants = await twin.asTenant(ADMIN, `select id from public.ocade_entitlement_grants`, {
      aal: "aal2",
    });
    expect(grants.rows).toHaveLength(0);
    const own = await twin.asTenant(CUSTOMER_B, `select id from public.ocade_entitlement_grants`);
    expect(own.rows).toHaveLength(1);
    await twin.execSuperuser(`delete from public.ocade_entitlement_grants`);
  });
});

describe("granting access by email", () => {
  const grant = (actor: string, email: string, role: string, session = fresh) =>
    twin.asTenant<{ result: { status: string; user_id?: string } }>(
      actor,
      `select public.ocade_staff_grant('${email}', '${role}', 'Hired to answer customers') as result`,
      session,
    );

  it("resolves a verified address to the account's stable id", async () => {
    const result = await grant(OWNER, "A@OCADE.TEST", "support");
    expect(result.rows[0]!.result).toEqual({ status: "granted", user_id: CUSTOMER_A });
    expect(await staff(CUSTOMER_A)).toBe("support");
    const [audit] = await twin.asServiceRole<{ actor: string; action: string }>(
      `select actor, action from public.ocade_admin_actions where target_user = '${CUSTOMER_A}'`,
    );
    expect(audit).toEqual({ actor: OWNER, action: "staff_grant" });
  });

  it("invites an address with no account, and the invitation becomes access on verification", async () => {
    expect((await grant(OWNER, "new.hire@ocade.test", "billing")).rows[0]!.result).toEqual({
      status: "invited",
    });
    const NEW = "01010101-7777-4aaa-8aaa-aaaaaaaaaaaa";
    await twin.execSuperuser(
      `insert into auth.users (id, email) values ('${NEW}', 'new.hire@ocade.test')`,
    );
    expect(await staff(NEW)).toBeNull(); // not verified yet: nothing
    await twin.execSuperuser(
      `update auth.users set email_confirmed_at = now() where id = '${NEW}'`,
    );
    expect(await staff(NEW)).toBe("billing");
    await twin.execSuperuser(`delete from auth.users where id = '${NEW}'`);
  });

  it("does not let an unverified address stand in for its owner", async () => {
    const SQUAT = "02020202-8888-4bbb-8bbb-bbbbbbbbbbbb";
    await twin.execSuperuser(
      `insert into auth.users (id, email) values ('${SQUAT}', 'future.admin@ocade.test')`,
    );
    expect((await grant(OWNER, "future.admin@ocade.test", "admin")).rows[0]!.result.status).toBe(
      "invited",
    );
    expect(await staff(SQUAT)).toBeNull();
    await twin.execSuperuser(`delete from auth.users where id = '${SQUAT}'`);
  });

  it("refuses escalation: customers, Admins, the Backup Owner naming a Backup Owner, self-grants", async () => {
    expect((await grant(CUSTOMER_A, "b@ocade.test", "admin")).error).toBe("Not found");
    expect((await grant(ADMIN, "b@ocade.test", "support")).error).toBe("Not found");
    expect((await grant(BACKUP, "b@ocade.test", "backup_owner")).error).toMatch(
      /Only the Primary Owner/,
    );
    expect((await grant(BACKUP, "backup@ocade.test", "admin")).error).toMatch(/own access/);
    expect((await grant(BACKUP, "owner@ocade.test", "support")).error).toMatch(/Primary Owner/);
    expect((await grant(OWNER, "b@ocade.test", "primary_owner")).error).toMatch(/not a staff role/);
    expect(await staff(CUSTOMER_B)).toBeNull();
  });

  it("needs a second factor, and a recent one", async () => {
    expect((await grant(OWNER, "b@ocade.test", "support", { aal: "aal1" } as never)).error).toMatch(
      /authenticator app/,
    );
    expect(
      (
        await grant(OWNER, "b@ocade.test", "support", {
          aal: "aal2",
          provedSecondsAgo: 3600,
        } as never)
      ).error,
    ).toMatch(/Confirm it is you before making this change\./);
    expect(await staff(CUSTOMER_B)).toBeNull();
  });
});

describe("removing access", () => {
  const revoke = (actor: string, user: string) =>
    twin.asTenant<{ ok: boolean }>(
      actor,
      `select public.ocade_staff_revoke('${user}', 'Left the company today') as ok`,
      fresh,
    );

  it("takes effect on the very next request", async () => {
    expect(await can(SUPPORT, "customers.read")).toBe(true);
    expect((await revoke(OWNER, SUPPORT)).rows[0]!.ok).toBe(true);
    expect(await can(SUPPORT, "customers.read")).toBe(false);
  });

  it("never removes the Primary Owner, and only the Primary Owner removes the Backup Owner", async () => {
    expect((await revoke(BACKUP, OWNER)).error).toMatch(/handing ownership over/);
    expect((await revoke(OWNER, OWNER)).error).toMatch(/handing ownership over/);
    expect(
      (
        await twin.asTenant(
          ADMIN,
          `select public.ocade_staff_revoke('${BACKUP}', 'Admin tries this')`,
          fresh,
        )
      ).error,
    ).toBe("Not found");
    expect(await staff(BACKUP)).toBe("backup_owner");
  });

  it("hands ownership only to the Backup Owner, and swaps them", async () => {
    const to = (user: string) =>
      twin.asTenant(
        OWNER,
        `select public.ocade_staff_transfer_ownership('${user}', 'Stepping back from operations')`,
        fresh,
      );
    expect((await to(ADMIN)).error).toMatch(/Make them an Owner first/);
    expect((await to(BACKUP)).error).toBeUndefined();
    expect(await staff(BACKUP)).toBe("primary_owner");
    expect(await staff(OWNER)).toBe("backup_owner");
  });
});

describe("sessions", () => {
  it("the emergency sign-out ends every staff session but the one asking, and no customer's", async () => {
    await twin.execSuperuser(`delete from auth.sessions`);
    const [mine] = await twin.asSuperuser<{ id: string }>(
      `insert into auth.sessions (user_id) values ('${OWNER}') returning id`,
    );
    await twin.execSuperuser(
      `insert into auth.sessions (user_id) values ('${OWNER}'), ('${ADMIN}'), ('${SUPPORT}'),
         ('${CUSTOMER_A}')`,
    );
    const result = await twin.asTenant<{ n: number }>(
      OWNER,
      `select public.ocade_staff_end_all_sessions('Suspected staff credential leak') as n`,
      { aal: "aal2", sessionId: mine!.id },
    );
    expect(result.rows[0]!.n).toBe(3);
    const left = await twin.asSuperuser<{ user_id: string }>(
      `select user_id from auth.sessions order by user_id`,
    );
    expect(left.map((row) => row.user_id).sort()).toEqual([OWNER, CUSTOMER_A].sort());
  });

  it("a staff token whose session was ended is no longer staff, straight at the database", async () => {
    await twin.execSuperuser(`delete from auth.sessions`);
    const [{ id: owners }] = await twin.asSuperuser<{ id: string }>(
      `insert into auth.sessions (user_id) values ('${OWNER}') returning id`,
    );
    const [{ id: admins }] = await twin.asSuperuser<{ id: string }>(
      `insert into auth.sessions (user_id) values ('${ADMIN}') returning id`,
    );
    const asAdmin = (sql: string) =>
      twin.asTenant<{ ok: boolean }>(ADMIN, sql, { aal: "aal2", sessionId: admins });
    expect(
      (await asAdmin(`select public.ocade_staff_can('customers.read') as ok`)).rows[0]!.ok,
    ).toBe(true);
    const ended = await twin.asTenant(
      OWNER,
      `select public.ocade_staff_end_all_sessions('Suspected staff credential leak')`,
      { aal: "aal2", sessionId: owners },
    );
    expect(ended.error).toBeUndefined();
    // The copied token is still signed and unexpired; the session behind it is gone.
    expect(
      (await asAdmin(`select public.ocade_staff_can('customers.read') as ok`)).rows[0]!.ok,
    ).toBe(false);
    expect((await asAdmin(`select * from public.ocade_my_staff()`)).rows).toHaveLength(1);
    const pause = await asAdmin(
      `select paused from public.ocade_set_service_control('jarvis_execution', true, 'With a token from an ended session') as ok`,
    );
    expect(pause.errorCode).toBe("42501");
    // The owner who asked keeps working.
    const still = await twin.asTenant<{ ok: boolean }>(
      OWNER,
      `select public.ocade_staff_can('staff.manage') as ok`,
      { aal: "aal2", sessionId: owners },
    );
    expect(still.rows[0]!.ok).toBe(true);
  });

  it("an Admin turns off a customer's lost two-step: sessions and old codes go, and it is recorded", async () => {
    await twin.execSuperuser(
      `delete from auth.sessions;
       insert into auth.sessions (user_id) values ('${CUSTOMER_A}'), ('${CUSTOMER_B}');
       insert into public.ocade_mfa_recovery_codes (user_id, code_hash)
       values ('${CUSTOMER_A}', repeat('a', 64)), ('${CUSTOMER_B}', repeat('b', 64));`,
    );
    const reset = (actor: string, user: string) =>
      twin.asTenant<{ ok: boolean }>(
        actor,
        `select public.ocade_staff_reset_second_factor('${user}', 'Lost phone and recovery codes') as ok`,
        fresh,
      );
    expect((await reset(ADMIN, OWNER)).error).toMatch(/changed by the owner/);
    expect((await reset(ADMIN, BACKUP)).error).toMatch(/changed by the owner/);
    expect((await reset(ADMIN, ADMIN)).error).toMatch(/their own/);
    expect((await reset(ADMIN, CUSTOMER_A)).rows[0]!.ok).toBe(true);
    // Only that account: its sessions and its old codes.
    const left = await twin.asSuperuser<{ user_id: string }>(`select user_id from auth.sessions`);
    expect(left.map((row) => row.user_id)).toEqual([CUSTOMER_B]);
    const codes = await twin.asSuperuser<{ user_id: string }>(
      `select user_id from public.ocade_mfa_recovery_codes`,
    );
    expect(codes.map((row) => row.user_id)).toEqual([CUSTOMER_B]);
    const [audit] = await twin.asServiceRole<{ actor: string; target_user: string }>(
      `select actor, target_user from public.ocade_admin_actions where action = 'second_factor_reset'`,
    );
    expect(audit).toEqual({ actor: ADMIN, target_user: CUSTOMER_A });
    const verify = await twin.runScript(
      "supabase/verification",
      "20260930094000_staff_can_turn_off_a_lost_second_factor_verify.sql",
    );
    expect(verify.error).toBeUndefined();
    await twin.execSuperuser(`delete from public.ocade_mfa_recovery_codes`);
  });

  it("support cannot end a customer's sessions; an Admin can, but not an owner's", async () => {
    await twin.execSuperuser(
      `insert into auth.sessions (user_id) values ('${CUSTOMER_B}'), ('${BACKUP}')`,
    );
    const end = (actor: string, user: string) =>
      twin.asTenant(
        actor,
        `select public.ocade_staff_end_customer_sessions('${user}', 'Account reported as taken over')`,
        fresh,
      );
    expect((await end(SUPPORT, CUSTOMER_B)).error).toBe("Not found");
    expect((await end(ADMIN, BACKUP)).error).toMatch(/ended by the owner/);
    expect((await end(ADMIN, CUSTOMER_B)).error).toBeUndefined();
    const left = await twin.asSuperuser(
      `select 1 from auth.sessions where user_id = '${CUSTOMER_B}'`,
    );
    expect(left).toHaveLength(0);
  });
});

describe("conversation access through a case", () => {
  let conversation: string;
  let other: string;

  beforeEach(async () => {
    await twin.execSuperuser(`delete from public.ocade_conversations`);
    [{ id: conversation }] = await twin.asServiceRole<{ id: string }>(
      `insert into public.ocade_conversations (user_id, title) values ('${CUSTOMER_A}', 'Help') returning id`,
    );
    [{ id: other }] = await twin.asServiceRole<{ id: string }>(
      `insert into public.ocade_conversations (user_id, title) values ('${CUSTOMER_B}', 'Private') returning id`,
    );
    await twin.asServiceRole(
      `insert into public.ocade_messages (user_id, conversation_id, role, content) values
         ('${CUSTOMER_A}', '${conversation}', 'user', 'my export fails'),
         ('${CUSTOMER_B}', '${other}', 'user', 'not yours')`,
    );
  });

  const open = (actor: string, hours = 24) =>
    twin.asTenant<{ id: string }>(
      actor,
      `select public.ocade_case_open('${CUSTOMER_A}', 'Customer reported export failure', ${hours}) as id`,
      fresh,
    );
  const read = (actor: string, kase: string, conv: string) =>
    twin.asTenant<{ content: string }>(
      actor,
      `select content from public.ocade_case_messages('${kase}', '${conv}')`,
      fresh,
    );

  it("is opened by an owner, with a reason and at most 72 hours", async () => {
    expect((await open(SUPPORT)).error).toBe("Not found");
    expect((await open(ADMIN)).error).toBe("Not found");
    expect((await open(OWNER, 100)).error).toMatch(/72 hours/);
    expect((await open(OWNER)).rows[0]!.id).toBeTruthy();
  });

  it("lets support read that customer's conversation, writes each read down, and nothing else", async () => {
    const kase = (await open(OWNER)).rows[0]!.id;
    expect((await read(SUPPORT, kase, conversation)).rows).toEqual([
      { content: "my export fails" },
    ]);
    expect((await read(SUPPORT, kase, other)).error).toBe("Not found");
    expect((await read(CUSTOMER_B, kase, conversation)).error).toBe("Not found");
    const reads = await twin.asServiceRole(
      `select 1 from public.ocade_admin_actions where action = 'case_read' and subject = '${kase}'`,
    );
    expect(reads).toHaveLength(1);
  });

  it("ends the moment the case is closed", async () => {
    const kase = (await open(OWNER)).rows[0]!.id;
    const short = await twin.asTenant(
      OWNER,
      `select public.ocade_case_close('${kase}', 'Done')`,
      fresh,
    );
    expect(short.error).toMatch(/at least ten/);
    const closed = await twin.asTenant(
      OWNER,
      `select public.ocade_case_close('${kase}', 'Resolved: export works again')`,
      fresh,
    );
    expect(closed.error).toBeUndefined();
    expect((await read(SUPPORT, kase, conversation)).error).toMatch(/closed or has expired/);
  });
});

describe("operator RPCs ask for their own permission", () => {
  it("support cannot pause JARVIS; operations can", async () => {
    await twin.execSuperuser(
      `insert into public.ocade_staff (user_id, role) values ('${CUSTOMER_B}', 'operations')`,
    );
    const pause = (user: string) =>
      twin.asTenant(
        user,
        `select paused from public.ocade_set_service_control('jarvis_execution', true, 'Operations drill for staff')`,
        fresh,
      );
    expect((await pause(SUPPORT)).error).toMatch(/Only support admins/);
    expect((await pause(CUSTOMER_B)).error).toBeUndefined();
    await twin.execSuperuser(
      `update public.ocade_service_controls set paused = false where key = 'jarvis_execution'`,
    );
  });
});

/**
 * ATTACKED FROM A BROWSER. Everything below is what somebody holding a token
 * (a customer's, a staff member's, or none) can send straight to PostgREST,
 * skipping the console entirely.
 */
describe("attacked from a browser", () => {
  const TABLES = [
    "ocade_staff",
    "ocade_staff_invites",
    "ocade_support_cases",
    "ocade_admin_actions",
  ];

  // Every privileged change, with arguments that would succeed for a fresh owner.
  const MUTATIONS: Record<string, string> = {
    grant: `select public.ocade_staff_grant('b@ocade.test', 'support', 'Hired to answer customers')`,
    permissions: `select public.ocade_staff_set_permissions('${SUPPORT}', '{usage.read}', '{}', 'Needs usage for billing calls')`,
    revoke: `select public.ocade_staff_revoke('${SUPPORT}', 'Left the company today')`,
    withdraw: `select public.ocade_staff_withdraw_invite('00000000-0000-4000-8000-000000000000', 'No longer joining us')`,
    transfer: `select public.ocade_staff_transfer_ownership('${BACKUP}', 'Stepping back from operations')`,
    endAll: `select public.ocade_staff_end_all_sessions('Suspected staff credential leak')`,
    endCustomer: `select public.ocade_staff_end_customer_sessions('${CUSTOMER_A}', 'Account reported as taken over')`,
    resetFactor: `select public.ocade_staff_reset_second_factor('${CUSTOMER_A}', 'Lost phone and recovery codes')`,
    caseOpen: `select public.ocade_case_open('${CUSTOMER_A}', 'Customer reported export failure', 24)`,
    caseClose: `select public.ocade_case_close('00000000-0000-4000-8000-000000000000', 'Resolved: export works again')`,
  };

  const snapshot = () =>
    twin.asServiceRole(
      `select user_id, role, granted, denied from public.ocade_staff order by user_id`,
    );

  it("gives no direct table access to anybody: anonymous, customer or staff", async () => {
    for (const table of TABLES) {
      expect((await twin.asAnon(`select * from public.${table}`)).errorCode, table).toBe("42501");
      for (const who of [CUSTOMER_A, SUPPORT, OWNER]) {
        expect(
          (await twin.asTenant(who, `select * from public.${table}`, fresh)).errorCode,
          `${table} read`,
        ).toBe("42501");
        expect(
          (await twin.asTenant(who, `delete from public.${table}`, fresh)).errorCode,
          `${table} delete`,
        ).toBe("42501");
      }
    }
    // The classic: a customer inserting their own staff row.
    const self = await twin.asTenant(
      CUSTOMER_A,
      `insert into public.ocade_staff (user_id, role) values ('${CUSTOMER_A}', 'primary_owner')`,
      fresh,
    );
    expect(self.errorCode).toBe("42501");
    expect(await staff(CUSTOMER_A)).toBeNull();
  });

  it("lets nobody without a session call a staff function", async () => {
    for (const [name, sql] of Object.entries(MUTATIONS)) {
      expect((await twin.asAnon(sql)).errorCode, name).toBe("42501");
    }
    for (const sql of [
      `select public.ocade_staff_can('customers.read')`,
      `select * from public.ocade_my_staff()`,
      `select * from public.ocade_case_messages('00000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-000000000000')`,
      `select public.ocade_bootstrap_primary_owner('a@ocade.test')`,
    ]) {
      expect((await twin.asAnon(sql)).errorCode, sql).toBe("42501");
    }
  });

  it("refuses every change to a customer, and tells them nothing", async () => {
    const before = await snapshot();
    for (const [name, sql] of Object.entries(MUTATIONS)) {
      const attempt = await twin.asTenant(CUSTOMER_A, sql, fresh);
      expect(attempt.error, name).toBe("Not found");
    }
    expect(await snapshot()).toEqual(before);
    expect(await twin.asServiceRole(`select 1 from public.ocade_admin_actions`)).toHaveLength(0);
  });

  it("refuses every change to an owner without a second factor, or with a stale one", async () => {
    const before = await snapshot();
    for (const [name, sql] of Object.entries(MUTATIONS)) {
      expect((await twin.asTenant(OWNER, sql, { aal: "aal1" })).error, `${name} aal1`).toMatch(
        /authenticator app/,
      );
      expect(
        (await twin.asTenant(OWNER, sql, { aal: "aal2", provedSecondsAgo: 3600 })).error,
        `${name} stale`,
      ).toMatch(/Confirm it is you/);
    }
    expect(await snapshot()).toEqual(before);
    expect(await twin.asServiceRole(`select 1 from public.ocade_admin_actions`)).toHaveLength(0);
  });

  it("refuses staff the modules they were not given", async () => {
    // Support holds customers.read, devices.read, tasks.read, cases.read and nothing else.
    for (const name of [
      "grant",
      "permissions",
      "revoke",
      "transfer",
      "endAll",
      "endCustomer",
      "resetFactor",
      "caseOpen",
    ]) {
      expect((await twin.asTenant(SUPPORT, MUTATIONS[name]!, fresh)).error, name).toBe("Not found");
    }
    // An Admin manages customers but never staff, and never opens a case.
    for (const name of ["grant", "permissions", "revoke", "transfer", "endAll", "caseOpen"]) {
      expect((await twin.asTenant(ADMIN, MUTATIONS[name]!, fresh)).error, name).toBe("Not found");
    }
  });

  it("nobody raises their own access, by any route", async () => {
    const tries = [
      [
        BACKUP,
        `select public.ocade_staff_grant('backup@ocade.test', 'admin', 'Promoting myself quietly')`,
      ],
      [
        BACKUP,
        `select public.ocade_staff_set_permissions('${BACKUP}', '{}', '{}', 'Changing my own access')`,
      ],
      [
        BACKUP,
        `select public.ocade_staff_transfer_ownership('${BACKUP}', 'Taking ownership myself')`,
      ],
      [
        BACKUP,
        `select public.ocade_staff_set_permissions('${OWNER}', '{}', '{staff.manage}', 'Locking the owner out')`,
      ],
      [
        OWNER,
        `select public.ocade_staff_set_permissions('${OWNER}', '{}', '{}', 'Changing my own access')`,
      ],
    ] as const;
    const before = await snapshot();
    for (const [who, sql] of tries) {
      expect((await twin.asTenant(who, sql, fresh)).error, sql).toBeDefined();
    }
    expect(await snapshot()).toEqual(before);
  });

  it("a removed permission is gone on the next request, for the same live session", async () => {
    expect(await can(ADMIN, "grants.manage")).toBe(true);
    const take = await twin.asTenant(
      OWNER,
      `select public.ocade_staff_set_permissions('${ADMIN}', '{}', '{grants.manage}', 'Billing moved to another team')`,
      fresh,
    );
    expect(take.error).toBeUndefined();
    expect(await can(ADMIN, "grants.manage")).toBe(false);
    const grant = await twin.asTenant(
      ADMIN,
      `select public.ocade_grant_entitlement('${CUSTOMER_A}', 'pro', 'Trying after losing the permission', 30)`,
      fresh,
    );
    expect(grant.errorCode).toBe("42501");
  });

  it("an invitation cannot be redeemed after it is withdrawn, replaced or expired", async () => {
    const invite = (role: string) =>
      twin.asTenant(
        OWNER,
        `select public.ocade_staff_grant('later@ocade.test', '${role}', 'Joining next month as staff')`,
        fresh,
      );
    const LATER = "03030303-9999-4ccc-8ccc-cccccccccccc";
    const arrive = async () => {
      await twin.execSuperuser(
        `insert into auth.users (id, email, email_confirmed_at) values ('${LATER}', 'later@ocade.test', now())`,
      );
      const role = await staff(LATER);
      await twin.execSuperuser(`delete from auth.users where id = '${LATER}'`);
      return role;
    };

    // Replaced: only the newest invitation counts.
    await invite("admin");
    await invite("read_only");
    expect(
      await twin.asServiceRole(
        `select 1 from public.ocade_staff_invites where email = 'later@ocade.test'
          and accepted_at is null and withdrawn_at is null`,
      ),
    ).toHaveLength(1);
    expect(await arrive()).toBe("read_only");

    // Withdrawn.
    await invite("admin");
    const [open] = await twin.asServiceRole<{ id: string }>(
      `select id from public.ocade_staff_invites where email = 'later@ocade.test'
        and accepted_at is null and withdrawn_at is null`,
    );
    const withdrawn = await twin.asTenant(
      OWNER,
      `select public.ocade_staff_withdraw_invite('${open!.id}', 'No longer joining us') as ok`,
      fresh,
    );
    expect(withdrawn.error).toBeUndefined();
    expect(await arrive()).toBeNull();

    // Expired.
    await invite("admin");
    await twin.execSuperuser(
      `update public.ocade_staff_invites set expires_at = now() - interval '1 minute'
        where email = 'later@ocade.test' and accepted_at is null and withdrawn_at is null`,
    );
    expect(await arrive()).toBeNull();
  });

  it("an accepted invitation is spent: the same address cannot use it twice", async () => {
    await twin.asTenant(
      OWNER,
      `select public.ocade_staff_grant('once@ocade.test', 'support', 'Joining the support team')`,
      fresh,
    );
    const ONCE = "04040404-aaaa-4ddd-8ddd-dddddddddddd";
    await twin.execSuperuser(
      `insert into auth.users (id, email, email_confirmed_at) values ('${ONCE}', 'once@ocade.test', now())`,
    );
    expect(await staff(ONCE)).toBe("support");
    // Removed, then the account's address is verified again (an email change round trip).
    await twin.asTenant(
      OWNER,
      `select public.ocade_staff_revoke('${ONCE}', 'Left the company today')`,
      fresh,
    );
    await twin.execSuperuser(
      `update auth.users set email_confirmed_at = now() where id = '${ONCE}'`,
    );
    expect(await staff(ONCE)).toBeNull();
    await twin.execSuperuser(`delete from auth.users where id = '${ONCE}'`);
  });

  it("a repeated change does nothing the second time", async () => {
    const revoke = () =>
      twin.asTenant<{ ok: boolean }>(
        OWNER,
        `select public.ocade_staff_revoke('${SUPPORT}', 'Left the company today') as ok`,
        fresh,
      );
    expect((await revoke()).rows[0]!.ok).toBe(true);
    expect((await revoke()).rows[0]!.ok).toBe(false);
    expect(
      await twin.asServiceRole(
        `select 1 from public.ocade_admin_actions where action = 'staff_revoke'`,
      ),
    ).toHaveLength(1);
  });

  it("a case that ran out reads nothing, and support needs its second factor to read at all", async () => {
    const [{ id: conversation }] = await twin.asServiceRole<{ id: string }>(
      `insert into public.ocade_conversations (user_id, title) values ('${CUSTOMER_A}', 'Help') returning id`,
    );
    const opened = await twin.asTenant<{ id: string }>(
      OWNER,
      `select public.ocade_case_open('${CUSTOMER_A}', 'Customer reported export failure', 1) as id`,
      fresh,
    );
    const kase = opened.rows[0]!.id;
    const read = (aal: "aal1" | "aal2") =>
      twin.asTenant(
        SUPPORT,
        `select * from public.ocade_case_messages('${kase}', '${conversation}')`,
        {
          aal,
        },
      );
    expect((await read("aal1")).error).toBe("Not found");
    expect((await read("aal2")).error).toBeUndefined();
    await twin.execSuperuser(
      `alter table public.ocade_support_cases disable trigger all;
       update public.ocade_support_cases
          set opened_at = now() - interval '2 hours', expires_at = now() - interval '1 hour'
        where id = '${kase}';
       alter table public.ocade_support_cases enable trigger all;`,
    );
    expect((await read("aal2")).error).toMatch(/closed or has expired/);
  });

  it("removing a staff account removes its access with it", async () => {
    const GONE = "05050505-bbbb-4eee-8eee-eeeeeeeeeeee";
    await twin.execSuperuser(
      `insert into auth.users (id, email, email_confirmed_at) values ('${GONE}', 'gone@ocade.test', now());
       insert into public.ocade_staff (user_id, role) values ('${GONE}', 'admin');
       delete from auth.users where id = '${GONE}';`,
    );
    expect(await staff(GONE)).toBeNull();
    expect(await can(GONE, "customers.read")).toBe(false);
  });

  it("every staff function pins its search path", async () => {
    const loose = await twin.asSuperuser<{ name: string }>(
      `select p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public', 'private')
          and (starts_with(p.proname, 'ocade_staff_') or starts_with(p.proname, 'ocade_case_')
               or p.proname in ('ocade_my_staff', 'ocade_bootstrap_primary_owner',
                                'ocade_accept_staff_invite', 'ocade_role_permissions'))
          and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) as c
                           where c like 'search_path=%')`,
    );
    expect(loose).toEqual([]);
  });
});

/**
 * LAST, BECAUSE IT TAKES THE AUTHORITY AWAY AND PUTS IT BACK. This is the path
 * production takes: operators exist as user_roles 'admin' rows when the
 * migration arrives, and a rollback must leave them operating.
 */
describe("the address the console shows", () => {
  it("is the sign-in address: an account cannot take somebody else's", async () => {
    const posing = await twin.asTenant(
      ADMIN,
      `update public.profiles set email = 'owner@ocade.test' where id = '${ADMIN}'`,
      fresh,
    );
    expect(posing.errorCode).toBe("42501");
    await twin.execSuperuser(
      `insert into public.profiles (id, email) values ('${CUSTOMER_B}', 'b@ocade.test')
         on conflict (id) do nothing;
       update auth.users set email = 'b-new@ocade.test' where id = '${CUSTOMER_B}'`,
    );
    expect(
      await twin.asServiceRole(`select email from public.profiles where id = '${CUSTOMER_B}'`),
    ).toEqual([{ email: "b-new@ocade.test" }]);
    await twin.execSuperuser(
      `update auth.users set email = 'b@ocade.test' where id = '${CUSTOMER_B}'`,
    );
  });
});

describe("staff act within their own reach", () => {
  const act = (user: string, sql: string) => twin.asTenant(user, sql, fresh);
  const why = "Checked who they are on a call";

  it("a colleague's two-step and sessions are an owner's to change", async () => {
    for (const sql of [
      `select public.ocade_staff_reset_second_factor('${SUPPORT}', '${why}')`,
      `select public.ocade_staff_end_customer_sessions('${SUPPORT}', '${why}')`,
    ]) {
      const refused = await act(ADMIN, sql);
      expect(refused.errorCode, sql).toBe("42501");
      expect(refused.error).toMatch(/changed by an owner/);
    }
    expect(
      (await act(OWNER, `select public.ocade_staff_end_customer_sessions('${SUPPORT}', '${why}')`))
        .error,
    ).toBeUndefined();
    // A customer is still the Admin's to help.
    expect(
      (
        await act(
          ADMIN,
          `select public.ocade_staff_end_customer_sessions('${CUSTOMER_A}', '${why}')`,
        )
      ).error,
    ).toBeUndefined();
  });

  it("nobody below an owner gives more than they hold", async () => {
    await twin.execSuperuser(
      `update public.ocade_staff set granted = '{staff.manage}' where user_id = '${ADMIN}'`,
    );
    const beyond = await act(
      ADMIN,
      `select public.ocade_staff_set_permissions('${SUPPORT}', '{cases.manage}', '{}', '${why}')`,
    );
    expect(beyond.error).toMatch(/hold yourself/);
    expect(
      (
        await act(
          ADMIN,
          `select public.ocade_staff_set_permissions('${SUPPORT}', '{usage.read}', '{}', '${why}')`,
        )
      ).error,
    ).toBeUndefined();
    expect(
      (await act(ADMIN, `select public.ocade_staff_grant('b@ocade.test', 'support', '${why}')`))
        .error,
    ).toBeUndefined();
    // An owner's reach is everything.
    expect(
      (
        await act(
          OWNER,
          `select public.ocade_staff_set_permissions('${SUPPORT}', '{cases.manage}', '{}', '${why}')`,
        )
      ).error,
    ).toBeUndefined();
  });
});

describe("rolled back and applied again", () => {
  const MIGRATION = "20260930093000_one_staff_authority";
  const apply = () => twin.runScript("supabase/migrations", `${MIGRATION}.sql`);
  const undo = () => twin.runScript("supabase/rollback", `${MIGRATION}_rollback.sql`);
  const legacyAdmin = async (user: string) =>
    (
      await twin.asTenant<{ r: boolean }>(
        user,
        `select public.has_role('${user}'::uuid, 'admin'::public.app_role) as r`,
      )
    ).rows[0]?.r;

  it("operators keep operating through a rollback, and come back as staff when it is applied again", async () => {
    expect((await undo()).error).toBeUndefined();
    expect(
      (
        await twin.asSuperuser<{ t: string | null }>(
          `select to_regclass('public.ocade_staff') as t`,
        )
      )[0]!.t,
    ).toBeNull();
    expect(await legacyAdmin(OWNER)).toBe(true);
    expect(await legacyAdmin(ADMIN)).toBe(true);
    expect(await legacyAdmin(SUPPORT)).toBe(false);
    // The operator RPC works again under the old check.
    const pause = await twin.asTenant(
      ADMIN,
      `select paused from public.ocade_set_service_control('jarvis_execution', false, 'Rollback drill for operators')`,
      fresh,
    );
    expect(pause.error).toBeUndefined();

    expect((await apply()).error).toBeUndefined();
    expect(await staff(OWNER)).toBe("admin");
    expect(await staff(BACKUP)).toBe("admin");
    expect(await staff(SUPPORT)).toBeNull();
    const verify = await twin.runScript("supabase/verification", `${MIGRATION}_verify.sql`);
    expect(verify.error).toBeUndefined();

    expect((await undo()).error).toBeUndefined();
    await twin.execSuperuser(
      `delete from public.user_roles where role = 'admin' and user_id <> '${OWNER}'`,
    );
    expect((await apply()).error).toBeUndefined();
    expect(await staff(OWNER)).toBe("primary_owner");
    // The legacy row is still there for the release that reads it...
    expect(
      await twin.asSuperuser(
        `select 1 from public.user_roles where user_id = '${OWNER}' and role = 'admin'`,
      ),
    ).toHaveLength(1);
    // ...and decides nothing: a row alone, without staff, is not an operator.
    await twin.execSuperuser(
      `insert into public.user_roles (user_id, role) values ('${CUSTOMER_A}', 'admin')`,
    );
    expect(await legacyAdmin(CUSTOMER_A)).toBe(false);
    const grant = await twin.asTenant(
      CUSTOMER_A,
      `select public.ocade_grant_entitlement('${CUSTOMER_B}', 'pro', 'A forged legacy admin row', 30)`,
      fresh,
    );
    expect(grant.errorCode).toBe("42501");
    await twin.execSuperuser(
      `delete from public.user_roles where user_id = '${CUSTOMER_A}' and role = 'admin'`,
    );
    const again = await twin.runScript("supabase/verification", `${MIGRATION}_verify.sql`);
    expect(again.error).toBeUndefined();
  });
});
