import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";

/**
 * WHAT AN OPERATOR CAN AND CANNOT REACH — PLAN.md §G, against real PostgreSQL.
 *
 * §G ends with the sentence these tests are written from: "Ordinary users
 * receive neither the route content nor the underlying data." A screen that
 * renders only for admins while the rows behind it stay reachable by anybody
 * with a token satisfies the first half and fails the second, and only the
 * second is a boundary — so every request below is issued directly to the
 * database under `SET ROLE authenticated`, which is what makes row-level
 * security apply at all.
 *
 * The other property is the one it is easy to grant by accident: an operator
 * needs to know whether notification delivery is WORKING, and answering that
 * from raw rows would hand them every title and body in the deployment.
 */

const OPERATOR = "aa000000-0000-4000-8000-000000000001";
const PERSON = "bb000000-0000-4000-8000-000000000002";
const STRANGER = "cc000000-0000-4000-8000-000000000003";

let twin: DatabaseTwin;

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(
    applied.filter((m) => !m.ok).map((m) => `${m.file}: ${m.error}`),
    "a migration failed",
  ).toEqual([]);

  for (const [id, email] of [
    [OPERATOR, "operator@example.com"],
    [PERSON, "person@example.com"],
    [STRANGER, "stranger@example.com"],
  ]) {
    await twin.execSuperuser(
      `insert into auth.users (id, email) values ('${id}', '${email}')
       on conflict (id) do nothing`,
    );
  }

  await twin.execSuperuser(
    `insert into public.user_roles (user_id, role) values ('${OPERATOR}', 'admin')
     on conflict do nothing`,
  );

  await twin.execSuperuser(
    `insert into public.ocade_commercial_usage (user_id, window_kind, window_start, used_hundredths)
     values ('${PERSON}', 'session', now() - interval '1 hour', 275),
            ('${STRANGER}', 'week', now() - interval '2 days', 1200)`,
  );

  await twin.execSuperuser(
    `insert into public.ocade_notifications
       (user_id, category, title, body, delivery, idempotency_key)
     values ('${PERSON}', 'security', 'A new sign-in', 'From a new device',
             '{"in_app": "sent", "email": "dead_letter"}'::jsonb, 'k1'),
            ('${STRANGER}', 'account', 'Welcome', 'Getting started',
             '{"in_app": "sent"}'::jsonb, 'k2')`,
  );
});

afterAll(async () => {
  await twin?.close();
});

describe("commercial usage windows", () => {
  it("shows an operator every account's windows", async () => {
    const rows = await twin.asTenant<{ user_id: string }>(
      OPERATOR,
      `select user_id from public.ocade_commercial_usage order by user_id`,
    );
    expect(rows.error).toBeUndefined();
    expect(rows.rows.map((row) => row.user_id)).toEqual([PERSON, STRANGER]);
  });

  it("still shows an ordinary account only its own", async () => {
    const rows = await twin.asTenant<{ user_id: string }>(
      PERSON,
      `select user_id from public.ocade_commercial_usage`,
    );
    expect(rows.error).toBeUndefined();
    expect(
      rows.rows.map((row) => row.user_id),
      "usage leaked between accounts",
    ).toEqual([PERSON]);
  });

  it("does not let an operator change what they are looking at", async () => {
    // An allowance an administrator can edit is an allowance that can be
    // granted by hand, which is the shape of the thing PLAN.md insists must go
    // through an audited entitlement instead.
    await twin.asTenant(
      OPERATOR,
      `update public.ocade_commercial_usage set used_hundredths = 0 where user_id = '${PERSON}'`,
    );
    const after = await twin.asSuperuser<{ used_hundredths: string }>(
      `select used_hundredths from public.ocade_commercial_usage
        where user_id = '${PERSON}' and window_kind = 'session'`,
    );
    expect(Number(after[0]?.used_hundredths), "an operator rewrote somebody's usage").toEqual(275);
  });
});

describe("notification delivery is counts, never content", () => {
  it("answers an operator with categories, channels and states", async () => {
    const rows = await twin.asTenant<{ category: string; channel: string; state: string }>(
      OPERATOR,
      `select category, channel, state, occurrences
         from public.ocade_admin_notification_delivery(now() - interval '7 days')
        order by category, channel`,
    );
    expect(rows.error).toBeUndefined();
    expect(rows.rows).toEqual([
      { category: "account", channel: "in_app", state: "sent", occurrences: 1 },
      { category: "security", channel: "email", state: "dead_letter", occurrences: 1 },
      { category: "security", channel: "in_app", state: "sent", occurrences: 1 },
    ]);
  });

  it("refuses an account without the admin role", async () => {
    const rows = await twin.asTenant(
      PERSON,
      `select * from public.ocade_admin_notification_delivery(now() - interval '7 days')`,
    );
    expect(rows.error, "a non-admin read the delivery aggregate").toMatch(/administrator/i);
  });

  it("gives an operator no way to read a title or a body", async () => {
    // The aggregate is the only door. There is no admin policy on the table, so
    // this returns the operator's own notifications — of which there are none.
    const rows = await twin.asTenant<{ title: string }>(
      OPERATOR,
      `select title from public.ocade_notifications`,
    );
    expect(rows.error).toBeUndefined();
    expect(rows.rows, "an administrator read somebody's notification content").toEqual([]);
  });
});
