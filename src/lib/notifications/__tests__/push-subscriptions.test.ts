import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";

/** Browser notification addresses, against real PostgreSQL and the real migrations. */
let twin: DatabaseTwin;
const A = "2a2a2a2a-1111-4aaa-8aaa-aaaaaaaaaaaa";
const B = "2b2b2b2b-2222-4bbb-8bbb-bbbbbbbbbbbb";
const MIGRATION = "20261001091000_web_push_subscriptions";
const SESSIONS = "20261001093000_push_follows_the_session";
const KEY = "B".repeat(87);
const AUTH = "a".repeat(22);
const endpoint = (n: number) => `https://fcm.googleapis.com/fcm/send/device-${n}`;
/** Each account's one browser session; a subscription belongs to the session that made it. */
const sessionOf: Record<string, string> = {};
const subscribe = (
  user: string,
  url: string,
  p256dh = KEY,
  auth = AUTH,
  sessionId = sessionOf[user],
) =>
  twin.asTenant(user, `select public.ocade_push_subscribe('${url}', '${p256dh}', '${auth}')`, {
    sessionId,
  });
const owners = async () =>
  twin.asServiceRole<{ endpoint: string; user_id: string }>(
    `select endpoint, user_id from public.ocade_push_subscriptions order by endpoint`,
  );

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(applied.filter((m) => !m.ok)).toEqual([]);
  await twin.execSuperuser(
    `insert into auth.users (id, email) values ('${A}', 'a@ocade.test'), ('${B}', 'b@ocade.test')
     on conflict do nothing`,
  );
  for (const user of [A, B]) {
    sessionOf[user] = (
      await twin.asSuperuser<{ id: string }>(
        `insert into auth.sessions (user_id) values ('${user}') returning id`,
      )
    )[0]!.id;
  }
}, 240_000);

afterAll(async () => {
  await twin?.close();
});

describe("a browser's notification address", () => {
  it("is recorded for the account signed in, and read by nobody but the server", async () => {
    expect((await subscribe(A, endpoint(1))).error).toBeUndefined();
    expect(await owners()).toEqual([{ endpoint: endpoint(1), user_id: A }]);
    const read = await twin.asTenant(A, `select * from public.ocade_push_subscriptions`);
    expect(read.errorCode).toBe("42501");
    const write = await twin.asTenant(
      A,
      `insert into public.ocade_push_subscriptions (endpoint, user_id, p256dh, auth)
       values ('${endpoint(9)}', '${B}', '${KEY}', '${AUTH}')`,
    );
    expect(write.errorCode).toBe("42501");
    expect(
      (
        await twin.asAnon(
          `select public.ocade_push_subscribe('${endpoint(2)}', '${KEY}', '${AUTH}')`,
        )
      ).errorCode,
    ).toBe("42501");
  });

  it("moves to whoever signs in on that browser next — the same browser, the same keys", async () => {
    expect((await subscribe(B, endpoint(1))).error).toBeUndefined();
    expect(await owners()).toEqual([{ endpoint: endpoint(1), user_id: B }]);
  });

  it("is not taken over by somebody who only knows the address", async () => {
    const stolen = await subscribe(A, endpoint(1), "C".repeat(87), "c".repeat(22));
    expect(stolen.errorCode).toBe("22023");
    expect(await owners()).toEqual([{ endpoint: endpoint(1), user_id: B }]);
  });

  it("needs a session, and ends with it", async () => {
    const noSession = await twin.asTenant(
      A,
      `select public.ocade_push_subscribe('${endpoint(5)}', '${KEY}', '${AUTH}')`,
    );
    expect(noSession.errorCode).toBe("42501");
    const [{ id: lost }] = await twin.asSuperuser<{ id: string }>(
      `insert into auth.sessions (user_id) values ('${A}') returning id`,
    );
    expect((await subscribe(A, endpoint(6), KEY, AUTH, lost)).error).toBeUndefined();
    // "Sign out everywhere", an emergency sign-out, a removed device: the session goes.
    await twin.execSuperuser(`delete from auth.sessions where id = '${lost}'`);
    expect((await owners()).some((row) => row.endpoint === endpoint(6))).toBe(false);
  });

  it("refuses what is not a browser's address", async () => {
    for (const [url, p256dh, auth] of [
      ["javascript:alert(1)", KEY, AUTH],
      ["http://example.com/push", KEY, AUTH],
      [endpoint(3), "not base64url!", AUTH],
      [endpoint(3), KEY, "x"],
      [`https://fcm.googleapis.com/${"x".repeat(1000)}`, KEY, AUTH],
    ]) {
      expect((await subscribe(A, url!, p256dh, auth)).errorCode, url).toBe("22023");
    }
  });

  it("is removed only by its own account", async () => {
    await twin.asTenant(A, `select public.ocade_push_unsubscribe('${endpoint(1)}')`);
    expect(await owners()).toHaveLength(1);
    await twin.asTenant(B, `select public.ocade_push_unsubscribe('${endpoint(1)}')`);
    expect(await owners()).toHaveLength(0);
  });

  it("keeps twenty browsers per person, the newest", async () => {
    for (let n = 0; n < 23; n += 1) {
      await subscribe(A, endpoint(100 + n));
      await twin.execSuperuser(
        `update public.ocade_push_subscriptions set created_at = now() - interval '${100 - n} seconds'
          where endpoint = '${endpoint(100 + n)}'`,
      );
    }
    const kept = await owners();
    expect(kept).toHaveLength(20);
    expect(kept.some((row) => row.endpoint === endpoint(100))).toBe(false);
    expect(kept.some((row) => row.endpoint === endpoint(122))).toBe(true);
  });

  it("goes with the account", async () => {
    await twin.execSuperuser(`delete from auth.users where id = '${A}'`);
    expect(await owners()).toHaveLength(0);
  });
});

describe("delivery is written by the server alone", () => {
  it("records a channel's outcome on the notification", async () => {
    const [{ id }] = await twin.asServiceRole<{ id: string }>(
      `select public.ocade_record_notification('${B}', 'task_outcomes', 'Done', '', null,
         'push-proof', '{"in_app":"sent","web_push":"sent"}'::jsonb) as id`,
    );
    await twin.asServiceRole(
      `select public.ocade_set_notification_delivery('${id}', 'web_push', 'failed')`,
    );
    const [row] = await twin.asServiceRole<{ delivery: Record<string, string> }>(
      `select delivery from public.ocade_notifications where id = '${id}'`,
    );
    expect(row!.delivery).toEqual({ in_app: "sent", web_push: "failed" });
    const browser = await twin.asTenant(
      B,
      `select public.ocade_set_notification_delivery('${id}', 'web_push', 'sent')`,
    );
    expect(browser.errorCode).toBe("42501");
  });
});

describe("rolled back and applied again", () => {
  it("undoes cleanly and verifies after reapplying, newest first", async () => {
    for (const name of [SESSIONS, MIGRATION]) {
      const undone = await twin.runScript("supabase/rollback", `${name}_rollback.sql`);
      expect(undone.error, name).toBeUndefined();
    }
    for (const name of [MIGRATION, SESSIONS]) {
      expect(
        (await twin.runScript("supabase/migrations", `${name}.sql`)).error,
        name,
      ).toBeUndefined();
      const verified = await twin.runScript("supabase/verification", `${name}_verify.sql`);
      expect(verified.error, name).toBeUndefined();
    }
  });
});
