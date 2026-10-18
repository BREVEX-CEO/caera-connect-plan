import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";
import { proofAction } from "@/lib/security/assurance";

/**
 * THE OWNER CONSOLE'S CUSTOMER OPERATIONS, AGAINST REAL POSTGRESQL.
 *
 * Usage given back through an append-only record, an account suspended and
 * restored, an account's deletion begun by an owner — each tried by the people
 * who must not be able to: customers, Support, Billing for what is not theirs,
 * an Admin on an owner or a colleague, anybody on themselves, without a second
 * factor or without recent proof.
 */
let twin: DatabaseTwin;
const OWNER = "2a2a2a2a-1111-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN = "2c2c2c2c-3333-4ccc-8ccc-cccccccccccc";
const BILLING = "2b2b2b2b-2222-4bbb-8bbb-bbbbbbbbbbbb";
const SUPPORT = "2d2d2d2d-4444-4ddd-8ddd-dddddddddddd";
const CUSTOMER = "2e2e2e2e-5555-4eee-8eee-eeeeeeeeeeee";
const OTHER = "2f2f2f2f-6666-4fff-8fff-ffffffffffff";

const as = (user: string, sql: string, aal: "aal1" | "aal2" = "aal2") =>
  // Each request confirmed afresh, as a person would: one proof covers one change.
  twin.asTenant<Record<string, unknown>>(user, sql, { aal, confirmEach: true });
const one = async (sql: string) => (await twin.asSuperuser<Record<string, unknown>>(sql))[0];

const adjust = (
  user: string,
  target: string,
  delta: number,
  reason = "Refund for an outage today",
) =>
  as(
    user,
    `select public.ocade_staff_adjust_usage('${target}', 'chat', 'session', ${delta}, '${reason}') as used`,
  );
const suspend = (user: string, target: string, on: boolean, aal: "aal1" | "aal2" = "aal2") =>
  as(
    user,
    `select public.ocade_staff_suspend_account('${target}', ${on}, 'Card fraud reported by the bank') as ok`,
    aal,
  );
const beginDeletion = (user: string, target: string, email: string) =>
  as(
    user,
    `select public.ocade_staff_begin_account_deletion('${target}', '${email}', 'The customer asked us by email') as ok`,
  );

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(applied.filter((m) => !m.ok)).toEqual([]);
}, 240_000);

afterAll(async () => {
  await twin?.close();
});

beforeEach(async () => {
  await twin.execSuperuser(
    `delete from public.ocade_staff; delete from auth.users where id in
       ('${OWNER}', '${ADMIN}', '${BILLING}', '${SUPPORT}', '${CUSTOMER}', '${OTHER}');
     insert into auth.users (id, email, email_confirmed_at) values
       ('${OWNER}', 'owner@ocade.test', now()), ('${ADMIN}', 'admin@ocade.test', now()),
       ('${BILLING}', 'billing@ocade.test', now()), ('${SUPPORT}', 'support@ocade.test', now()),
       ('${CUSTOMER}', 'Customer@Ocade.test', now()), ('${OTHER}', 'other@ocade.test', now());
     insert into public.profiles (id, email) values ('${CUSTOMER}', 'customer@ocade.test'),
       ('${OTHER}', 'other@ocade.test') on conflict (id) do nothing;
     insert into public.ocade_staff (user_id, role) values ('${OWNER}', 'primary_owner'),
       ('${ADMIN}', 'admin'), ('${BILLING}', 'billing'), ('${SUPPORT}', 'support');
     insert into auth.sessions (user_id) values ('${CUSTOMER}'), ('${CUSTOMER}');
     insert into public.jarvis_devices (user_id, name) values ('${CUSTOMER}', 'Desk');
     insert into public.ocade_conversations (id, user_id, title, surface)
       values ('${CUSTOMER.replace("2e2e2e2e", "3e3e3e3e")}', '${CUSTOMER}', 'Work', 'jarvis');
     insert into public.jarvis_tasks (user_id, conversation_id, title, status, plan)
       values ('${CUSTOMER}', '${CUSTOMER.replace("2e2e2e2e", "3e3e3e3e")}', 'Report', 'running', '["Write"]');`,
  );
});

describe("the migration", () => {
  it("passes its verification script, and rolls back and applies again", async () => {
    const verify = () =>
      twin.runScript(
        "supabase/verification",
        "20261002090000_owner_customer_operations_verify.sql",
      );
    expect((await verify()).error).toBeUndefined();
    const undo = await twin.runScript(
      "supabase/rollback",
      "20261002090000_owner_customer_operations_rollback.sql",
    );
    expect(undo.error).toBeUndefined();
    expect(
      (await twin.runScript("supabase/migrations", "20261002090000_owner_customer_operations.sql"))
        .error,
    ).toBeUndefined();
    expect((await verify()).error).toBeUndefined();
    // A historical rollback test must leave the current authorization contract installed.
    expect(
      (
        await twin.runScript(
          "supabase/migrations",
          "20261018163814_customer_proofs_bind_the_account.sql",
        )
      ).error,
    ).toBeUndefined();
  });
});

describe("a confirmation belongs to one customer", () => {
  const changes = [
    [
      "end a customer's sessions",
      (id: string) =>
        `public.ocade_staff_end_customer_sessions('${id}', 'The customer requested this')`,
    ],
    [
      "turn off a customer's two-step verification",
      (id: string) =>
        `public.ocade_staff_reset_second_factor('${id}', 'The customer requested this')`,
    ],
    [
      "change a customer's usage",
      (id: string) =>
        `public.ocade_staff_adjust_usage('${id}', 'chat', 'session', 100, 'The customer requested this')`,
    ],
    [
      "suspend an account",
      (id: string) =>
        `public.ocade_staff_suspend_account('${id}', true, 'The customer requested this')`,
    ],
    [
      "restore an account",
      (id: string) =>
        `public.ocade_staff_suspend_account('${id}', false, 'The customer requested this')`,
    ],
    [
      "delete an account",
      (id: string) =>
        `public.ocade_staff_begin_account_deletion('${id}', '${id === CUSTOMER ? "customer" : "other"}@ocade.test', 'The customer requested this')`,
    ],
  ] as const;

  it.each(changes)("%s cannot be redirected to another customer", async (action, operation) => {
    const [{ id }] = await twin.asSuperuser<{ id: string }>(
      `insert into auth.sessions (user_id) values ('${OWNER}') returning id`,
    );
    const proof = {
      aal: "aal2" as const,
      sessionId: id,
      provedAt: Math.floor(Date.now() / 1000) - 13,
    };
    const legacy = { ...proof, provedAt: proof.provedAt - 1 };
    const oldSpend = await twin.asTenant<{ ok: boolean }>(
      OWNER,
      `select public.ocade_spend_proof('${action.replaceAll("'", "''")}', '${"f".repeat(64)}') as ok`,
      legacy,
    );
    expect(oldSpend.rows[0]?.ok).toBe(true);
    expect((await twin.asTenant(OWNER, `select ${operation(OTHER)}`, legacy)).errorCode).toBe(
      "42501",
    );
    const spent = await twin.asTenant<{ ok: boolean }>(
      OWNER,
      `select public.ocade_spend_proof('${action.replaceAll("'", "''")}: ${CUSTOMER}', '${"e".repeat(64)}') as ok`,
      proof,
    );
    expect(spent.error).toBeUndefined();
    expect(spent.rows[0]?.ok).toBe(true);
    const snapshot = () =>
      twin.asSuperuser(
        `select banned_until, (select count(*) from public.ocade_admin_actions where target_user = '${OTHER}') as changes from auth.users where id = '${OTHER}'`,
      );
    const before = await snapshot();
    const refused = await twin.asTenant(OWNER, `select ${operation(OTHER)}`, proof);
    expect(refused.errorCode).toBe("42501");
    expect(await snapshot()).toEqual(before);
    const meant = await twin.asTenant(OWNER, `select ${operation(CUSTOMER)}`, proof);
    expect(meant.error).toBeUndefined();
    expect((await twin.asTenant(OWNER, `select ${operation(CUSTOMER)}`, proof)).errorCode).toBe(
      "42501",
    );
  });
});

describe("the exact-customer proof repair", () => {
  it("does not confuse long operator email addresses with the same first 120 action characters", async () => {
    const prefix = "change who operates OCADE: add ";
    const email = `${"a".repeat(64)}@${"b".repeat(63)}.example.invalid`;
    const other = email.replace(".example.invalid", ".other.invalid");
    const action = prefix + email;
    expect(action.slice(0, 120)).toBe((prefix + other).slice(0, 120));
    const [{ id }] = await twin.asSuperuser<{ id: string }>(
      `insert into auth.sessions (user_id) values ('${OWNER}') returning id`,
    );
    const proof = {
      aal: "aal2" as const,
      sessionId: id,
      provedAt: Math.floor(Date.now() / 1000) - 17,
    };
    expect(
      (
        await twin.asTenant<{ ok: boolean }>(
          OWNER,
          `select public.ocade_spend_proof('${action.slice(0, 120)}', '${"a".repeat(64)}') as ok`,
          proof,
        )
      ).rows[0]?.ok,
    ).toBe(true);
    const redirected = await twin.asTenant(
      OWNER,
      `select public.ocade_staff_grant('${other}', 'read_only', 'Access was confirmed for somebody else')`,
      proof,
    );
    expect(redirected.errorCode).toBe("42501");
    const intended = { ...proof, provedAt: proof.provedAt - 1 };
    const key = await proofAction(action);
    expect(key).toHaveLength(120);
    expect(key).not.toBe(await proofAction(prefix + other));
    expect(
      (
        await twin.asTenant<{ ok: boolean }>(
          OWNER,
          `select public.ocade_spend_proof('${key}', '${"b".repeat(64)}') as ok`,
          intended,
        )
      ).rows[0]?.ok,
    ).toBe(true);
    expect(
      (
        await twin.asTenant(
          OWNER,
          `select public.ocade_staff_grant('${other}', 'read_only', 'Not the intended operator')`,
          intended,
        )
      ).errorCode,
    ).toBe("42501");
    expect(
      (
        await twin.asTenant(
          OWNER,
          `select public.ocade_staff_grant('${email}', 'read_only', 'The intended operator was confirmed')`,
          intended,
        )
      ).error,
    ).toBeUndefined();
    expect(
      (
        await twin.asSuperuser<{ email: string }>(`select email from public.ocade_staff_invites`)
      ).map((row) => row.email),
    ).toEqual([email]);
  });

  it("verifies, demonstrates the rollback and restores the repair", async () => {
    const name = "20261018163814_customer_proofs_bind_the_account";
    const verify = () => twin.runScript("supabase/verification", `${name}_verify.sql`);
    expect((await verify()).error).toBeUndefined();
    expect(
      (await twin.runScript("supabase/rollback", `${name}_rollback.sql`)).error,
    ).toBeUndefined();
    expect((await verify()).error).toMatch(
      /truncates long action targets|does not bind the customer/,
    );
    expect((await twin.runScript("supabase/migrations", `${name}.sql`)).error).toBeUndefined();
    expect((await verify()).error).toBeUndefined();
  });
});

describe("usage given back", () => {
  it("by Billing, recorded and never changed afterwards; the customer's window moves", async () => {
    await twin.execSuperuser(
      `insert into public.ocade_commercial_usage (user_id, window_kind, window_start, used_hundredths)
       select '${CUSTOMER}', public.ocade_usage_window_kind('chat', u.window_kind), u.window_start, 2500
         from public.ocade_read_commercial_usage('${CUSTOMER}', 'chat') u where u.window_kind = 'session'`,
    );
    const given = await adjust(BILLING, CUSTOMER, -1000);
    expect(given.error).toBeUndefined();
    const record = await one(
      `select delta_hundredths, used_before, used_after, actor from public.ocade_usage_adjustments
        where user_id = '${CUSTOMER}'`,
    );
    expect(record).toMatchObject({ delta_hundredths: -1000, used_after: 1500, actor: BILLING });
    // Nothing can change or erase it, not even the server's own key.
    const erase = await twin
      .asServiceRole(`delete from public.ocade_usage_adjustments`)
      .catch((error: Error) => error);
    expect(String(erase)).toMatch(/permission denied/);
    // Never below zero.
    expect((await adjust(BILLING, CUSTOMER, -99_999)).error).toBeUndefined();
    expect(
      await one(`select min(used_hundredths) as used from public.ocade_commercial_usage
                  where user_id = '${CUSTOMER}' and window_kind = 'session'`),
    ).toMatchObject({ used: 0 });
  });

  it("not by Support, a customer, anybody on themselves, or without a reason", async () => {
    expect((await adjust(SUPPORT, CUSTOMER, -100)).errorCode).toBe("42501");
    expect((await adjust(CUSTOMER, CUSTOMER, -100)).errorCode).toBe("42501");
    expect((await adjust(OTHER, CUSTOMER, -100)).errorCode).toBe("42501");
    expect((await adjust(BILLING, BILLING, -100)).errorCode).toBe("42501");
    expect((await adjust(BILLING, CUSTOMER, -100, "short")).errorCode).toBe("22023");
    expect((await adjust(BILLING, OWNER, -100)).errorCode).toBe("42501");
  });
});

describe("an account suspended", () => {
  it("stops at once everywhere, and is restored by the same authority", async () => {
    expect((await suspend(ADMIN, CUSTOMER, true)).error).toBeUndefined();
    const after = await one(
      `select (select banned_until > now() + interval '50 years' from auth.users where id = '${CUSTOMER}') as banned,
              (select count(*) from auth.sessions where user_id = '${CUSTOMER}') as sessions,
              (select count(*) from public.jarvis_devices where user_id = '${CUSTOMER}' and revoked_at is null) as devices,
              (select status from public.jarvis_tasks where user_id = '${CUSTOMER}') as task`,
    );
    expect(after).toMatchObject({ banned: true, sessions: 0, devices: 0, task: "stopped" });
    expect((await suspend(ADMIN, CUSTOMER, false)).error).toBeUndefined();
    expect(await one(`select banned_until from auth.users where id = '${CUSTOMER}'`)).toMatchObject(
      { banned_until: null },
    );
    const audit = await twin.asSuperuser<{ action: string }>(
      `select action from public.ocade_admin_actions where target_user = '${CUSTOMER}' order by created_at`,
    );
    expect(audit.map((row) => row.action)).toEqual(["account_suspended", "account_restored"]);
  });

  it("never by Billing or Support, never an owner or a colleague by an Admin, never with one factor", async () => {
    expect((await suspend(BILLING, CUSTOMER, true)).errorCode).toBe("42501");
    expect((await suspend(SUPPORT, CUSTOMER, true)).errorCode).toBe("42501");
    expect((await suspend(ADMIN, OWNER, true)).errorCode).toBe("42501");
    expect((await suspend(ADMIN, BILLING, true)).errorCode).toBe("42501");
    expect((await suspend(ADMIN, CUSTOMER, true, "aal1")).errorCode).toBe("42501");
    expect((await suspend(OWNER, OWNER, true)).errorCode).toBe("42501");
    expect(await one(`select banned_until from auth.users where id = '${CUSTOMER}'`)).toMatchObject(
      { banned_until: null },
    );
  });
});

describe("an account's deletion begun by an owner", () => {
  it("needs the owner, the account's own address typed, and no staff role on it", async () => {
    expect((await beginDeletion(ADMIN, CUSTOMER, "customer@ocade.test")).errorCode).toBe("42501");
    expect((await beginDeletion(OWNER, CUSTOMER, "other@ocade.test")).errorCode).toBe("22023");
    expect((await beginDeletion(OWNER, SUPPORT, "support@ocade.test")).errorCode).toBe("42501");
    expect((await beginDeletion(OWNER, OWNER, "owner@ocade.test")).errorCode).toBe("42501");
    const begun = await beginDeletion(OWNER, CUSTOMER, " customer@ocade.test ");
    expect(begun.error).toBeUndefined();
    expect(
      await one(
        `select (select count(*) from auth.sessions where user_id = '${CUSTOMER}') as sessions,
                (select banned_until is not null from auth.users where id = '${CUSTOMER}') as banned`,
      ),
    ).toMatchObject({ sessions: 0, banned: true });
    // Half erased is never handed back: restoring a deletion in progress is refused.
    expect((await suspend(ADMIN, CUSTOMER, false)).errorCode).toBe("42501");
  });
});
