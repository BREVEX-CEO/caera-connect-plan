import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";
import { NOTIFICATION_CATEGORIES } from "../categories";

/**
 * THE NOTIFICATION SCHEMA, AGAINST REAL POSTGRES AND REAL POLICIES.
 *
 * PLAN.md §D asks for cross-device preference synchronisation, notification
 * history with read state, duplicate collapse and idempotency, minimal secure
 * payloads, and server-side audience authorisation immediately before send.
 * Every one of those is a property of the SCHEMA rather than of the code that
 * calls it, and every one fails silently if it is wrong: a missing unique
 * constraint duplicates a security alert rather than raising, an over-broad
 * UPDATE policy lets somebody rewrite a notification they received, and a
 * missing deep-link check turns an OCADE-branded alert into a phishing link.
 *
 * These run under `SET ROLE authenticated` with a real JWT claim, because that
 * is the only way row-level security applies at all — PGlite connects as a
 * superuser, and a superuser bypasses every policy.
 */

let twin: DatabaseTwin;
const ALICE = "11111111-1111-4111-8111-111111111111";
const MALLORY = "22222222-2222-4222-8222-222222222222";

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  await twin.applyMigrations();
  for (const id of [ALICE, MALLORY]) {
    await twin.asSuperuser(
      `insert into auth.users (id, email) values ('${id}', '${id}@example.test')
       on conflict (id) do nothing`,
    );
  }
}, 300_000);

afterAll(async () => {
  await twin?.close();
});

describe("the categories the schema will accept", () => {
  it("accepts exactly the ones the product declares", async () => {
    /*
     * Two lists, and the failure is asymmetric. A category the product has and
     * the schema refuses is a notification that cannot be recorded at all; a
     * category the schema allows and the product does not is a row nothing can
     * ever render. Both are silent, so both are checked.
     */
    for (const category of NOTIFICATION_CATEGORIES) {
      const inserted = await twin.asSuperuser<{ id: string }>(
        `select public.ocade_record_notification(
           '${ALICE}'::uuid, '${category.id}', 'title', 'body', null,
           'category-${category.id}', '{}'::jsonb) as id`,
      );
      expect(inserted[0]?.id, category.id).toBeTruthy();
    }
    const rows = await twin.asSuperuser<{ n: string }>(
      `select count(*) as n from public.ocade_notifications where user_id = '${ALICE}'`,
    );
    expect(Number(rows[0].n)).toBe(NOTIFICATION_CATEGORIES.length);
  });

  it("refuses one the product does not have", async () => {
    await expect(
      twin.asSuperuser(
        `select public.ocade_record_notification(
           '${ALICE}'::uuid, 'marketing', 'title', '', null, 'bad-category', '{}'::jsonb)`,
      ),
    ).rejects.toThrow();
  });
});

describe("duplicate collapse", () => {
  it("records one row for a key sent twice, and returns the same id both times", async () => {
    const first = await twin.asSuperuser<{ id: string }>(
      `select public.ocade_record_notification(
         '${ALICE}'::uuid, 'security', 'New sign-in', '', '/settings/security',
         'signin-2026-09-04', '{}'::jsonb) as id`,
    );
    const second = await twin.asSuperuser<{ id: string }>(
      `select public.ocade_record_notification(
         '${ALICE}'::uuid, 'security', 'New sign-in', '', '/settings/security',
         'signin-2026-09-04', '{}'::jsonb) as id`,
    );
    expect(second[0].id).toBe(first[0].id);
    const rows = await twin.asSuperuser<{ n: string }>(
      `select count(*) as n from public.ocade_notifications
        where user_id = '${ALICE}' and idempotency_key = 'signin-2026-09-04'`,
    );
    expect(Number(rows[0].n)).toBe(1);
  });

  it("lets two accounts use the same key, because the key is theirs", async () => {
    const mine = await twin.asSuperuser<{ id: string }>(
      `select public.ocade_record_notification(
         '${MALLORY}'::uuid, 'security', 'New sign-in', '', null,
         'signin-2026-09-04', '{}'::jsonb) as id`,
    );
    expect(mine[0].id).toBeTruthy();
  });
});

describe("what a notification may carry", () => {
  it("refuses a deep link that leaves this origin", async () => {
    for (const link of ["https://elsewhere.example/x", "//elsewhere.example/x", "javascript:x"]) {
      await expect(
        twin.asSuperuser(
          `insert into public.ocade_notifications
             (user_id, category, title, idempotency_key, deep_link)
           values ('${ALICE}'::uuid, 'security', 'x', 'link-${encodeURIComponent(link)}', '${link}')`,
        ),
        link,
      ).rejects.toThrow();
    }
  });

  it("accepts a same-origin path", async () => {
    await twin.asSuperuser(
      `insert into public.ocade_notifications
         (user_id, category, title, idempotency_key, deep_link)
       values ('${ALICE}'::uuid, 'security', 'x', 'link-ok', '/settings/security?tab=sessions')`,
    );
  });

  it("refuses a body long enough to be a payload rather than a summary", async () => {
    await expect(
      twin.asSuperuser(
        `insert into public.ocade_notifications
           (user_id, category, title, body, idempotency_key)
         values ('${ALICE}'::uuid, 'security', 'x', repeat('a', 2001), 'too-long')`,
      ),
    ).rejects.toThrow();
  });
});

describe("who may read and write", () => {
  it("shows an account only its own notifications", async () => {
    const mine = await twin.asTenant<{ n: string }>(
      ALICE,
      `select count(*) as n from public.ocade_notifications`,
    );
    const theirs = await twin.asTenant<{ n: string }>(
      MALLORY,
      `select count(*) as n from public.ocade_notifications`,
    );
    expect(Number(mine.rows[0].n)).toBeGreaterThan(1);
    expect(Number(theirs.rows[0].n)).toBe(1);
  });

  it("refuses a browser writing itself a notification", async () => {
    const attempt = await twin.asTenant(
      MALLORY,
      `insert into public.ocade_notifications
         (user_id, category, title, idempotency_key)
       values ('${MALLORY}'::uuid, 'billing', 'You have been upgraded', 'self-written')`,
    );
    expect(attempt.error, "a browser inserted a notification").toBeTruthy();
  });

  it("refuses a browser rewriting a notification it received", async () => {
    const attempt = await twin.asTenant(
      ALICE,
      `update public.ocade_notifications set title = 'nothing happened' where user_id = '${ALICE}'`,
    );
    expect(attempt.error, "a browser rewrote a notification").toBeTruthy();
  });

  it("refuses the recorder to an ordinary account", async () => {
    const attempt = await twin.asTenant(
      MALLORY,
      `select public.ocade_record_notification(
         '${MALLORY}'::uuid, 'billing', 'x', '', null, 'privilege-probe', '{}'::jsonb)`,
    );
    expect(attempt.error, "authenticated could record a notification").toBeTruthy();
  });
});

describe("read state", () => {
  it("marks one read, and only for its owner", async () => {
    const rows = await twin.asSuperuser<{ id: string }>(
      `select id from public.ocade_notifications where user_id = '${ALICE}' limit 1`,
    );
    const id = rows[0].id;

    const stranger = await twin.asTenant<{ ocade_mark_notification_read: number }>(
      MALLORY,
      `select public.ocade_mark_notification_read('${id}'::uuid)`,
    );
    expect(stranger.rows[0].ocade_mark_notification_read).toBe(0);

    const owner = await twin.asTenant<{ ocade_mark_notification_read: number }>(
      ALICE,
      `select public.ocade_mark_notification_read('${id}'::uuid)`,
    );
    expect(owner.rows[0].ocade_mark_notification_read).toBe(1);

    // Marking it again is not an error and is not a second read.
    const again = await twin.asTenant<{ ocade_mark_notification_read: number }>(
      ALICE,
      `select public.ocade_mark_notification_read('${id}'::uuid)`,
    );
    expect(again.rows[0].ocade_mark_notification_read).toBe(0);
  });

  it("marks everything read without reaching another account", async () => {
    const cleared = await twin.asTenant<{ ocade_mark_all_notifications_read: number }>(
      ALICE,
      `select public.ocade_mark_all_notifications_read()`,
    );
    expect(cleared.rows[0].ocade_mark_all_notifications_read).toBeGreaterThan(0);

    const strangerUnread = await twin.asSuperuser<{ n: string }>(
      `select count(*) as n from public.ocade_notifications
        where user_id = '${MALLORY}' and read_at is null`,
    );
    expect(Number(strangerUnread[0].n)).toBe(1);
  });
});

describe("preferences", () => {
  it("saves once, updates thereafter, and moves the revision each time", async () => {
    const first = await twin.asTenant<{ ocade_save_notification_preferences: string }>(
      ALICE,
      `select public.ocade_save_notification_preferences(
         true, '{"enabled": true, "fromHour": 22, "toHour": 7, "timeZone": "Asia/Kolkata"}'::jsonb,
         '{"security": {"channels": ["in_app"], "frequency": "immediate"}}'::jsonb)`,
    );
    expect(Number(first.rows[0].ocade_save_notification_preferences)).toBe(1);

    const second = await twin.asTenant<{ ocade_save_notification_preferences: string }>(
      ALICE,
      `select public.ocade_save_notification_preferences(
         false, '{"enabled": false, "fromHour": 22, "toHour": 7, "timeZone": "UTC"}'::jsonb,
         '{}'::jsonb)`,
    );
    expect(Number(second.rows[0].ocade_save_notification_preferences)).toBe(2);

    const rows = await twin.asSuperuser<{ mute_optional: boolean; revision: string }>(
      `select mute_optional, revision from public.ocade_notification_preferences
        where user_id = '${ALICE}'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].mute_optional).toBe(false);
  });

  it("shows an account only its own preferences", async () => {
    const theirs = await twin.asTenant<{ n: string }>(
      MALLORY,
      `select count(*) as n from public.ocade_notification_preferences`,
    );
    expect(Number(theirs.rows[0].n)).toBe(0);
  });

  it("cannot be written for somebody else, because the account is not a parameter", async () => {
    // `ocade_save_notification_preferences` takes no user id at all: it writes
    // `auth.uid()`. There is no argument to aim at another account.
    const attempt = await twin.asTenant(
      MALLORY,
      `insert into public.ocade_notification_preferences (user_id, mute_optional)
       values ('${ALICE}'::uuid, true)`,
    );
    expect(attempt.error, "one account wrote another's preferences").toBeTruthy();
  });
});
