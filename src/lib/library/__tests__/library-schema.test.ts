import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";

/**
 * ONE LIBRARY PER ACCOUNT, AND NOBODY ELSE CAN REACH IT.
 *
 * `PLAN.md` Phase 8's gate is exactly this: "cross-device Library data and
 * private object access are proven through Supabase/RLS". Cross-device is not a
 * thing a browser can demonstrate — two browsers reading the same account read
 * the same rows because the rows are the account's, not the device's — so what
 * has to be proven is that the ROWS are scoped to the account and to nothing
 * else, and that is a database property.
 *
 * Run against real PostgreSQL with the real migrations, under `SET ROLE
 * authenticated`, because a superuser bypasses row-level security and a test
 * that runs as one proves nothing at all.
 */

let twin: DatabaseTwin;

const OWNER = "00000000-0000-4000-8000-00000000c001";
const STRANGER = "00000000-0000-4000-8000-00000000c002";

async function seed(
  user: string,
  name: string,
  kind: "image" | "file" = "file",
  source: "upload" | "generated" = "upload",
): Promise<string> {
  const rows = await twin.asSuperuser<{ id: string }>(
    `insert into public.ocade_library_items (user_id, kind, source, name, mime, size_bytes, storage_path)
     values ('${user}', '${kind}', '${source}', '${name.replaceAll("'", "''")}',
             '${kind === "image" ? "image/png" : "text/plain"}', 10,
             '${user}/${crypto.randomUUID()}')
     returning id`,
  );
  return rows[0]!.id;
}

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(
    applied.filter((migration) => !migration.ok).map((migration) => migration.file),
    "a migration failed",
  ).toEqual([]);

  for (const [id, email] of [
    [OWNER, "library-owner@invalid.test"],
    [STRANGER, "library-stranger@invalid.test"],
  ]) {
    await twin.execSuperuser(
      `insert into auth.users (id, email) values ('${id}', '${email}') on conflict (id) do nothing`,
    );
  }
}, 120_000);

afterAll(async () => {
  await twin?.close();
});

beforeEach(async () => {
  await twin.execSuperuser(`delete from public.ocade_library_items`);
  await twin.execSuperuser(`delete from public.storage_tombstones`);
});

describe("what an account can see", () => {
  it("shows every item it owns, whichever device asks", async () => {
    await seed(OWNER, "notes.txt");
    await seed(OWNER, "diagram.png", "image", "generated");

    const rows = await twin.asTenant<{ name: string }>(
      OWNER,
      `select name from public.ocade_library_items order by name`,
    );
    expect(rows.rows.map((row) => row.name)).toEqual(["diagram.png", "notes.txt"]);
  });

  it("shows nothing belonging to anybody else", async () => {
    await seed(STRANGER, "theirs.txt");
    const rows = await twin.asTenant(OWNER, `select * from public.ocade_library_items`);
    expect(rows.rows).toHaveLength(0);
  });
});

describe("what an account cannot do to somebody else's", () => {
  it("cannot rename it", async () => {
    const id = await seed(STRANGER, "theirs.txt");
    await twin.asTenant(
      OWNER,
      `update public.ocade_library_items set name = 'taken.txt' where id = '${id}'`,
    );
    const after = await twin.asSuperuser<{ name: string }>(
      `select name from public.ocade_library_items where id = '${id}'`,
    );
    expect(after[0]!.name).toBe("theirs.txt");
  });

  it("cannot delete it", async () => {
    const id = await seed(STRANGER, "theirs.txt");
    await twin.asTenant(OWNER, `delete from public.ocade_library_items where id = '${id}'`);
    const after = await twin.asSuperuser<{ count: string }>(
      `select count(*) from public.ocade_library_items where id = '${id}'`,
    );
    expect(Number(after[0]!.count)).toBe(1);
  });

  it("cannot file an item into it", async () => {
    const attempt = await twin.asTenant(
      OWNER,
      `insert into public.ocade_library_items (user_id, kind, source, name, mime, size_bytes, storage_path)
       values ('${STRANGER}', 'file', 'upload', 'planted.txt', 'text/plain', 1, '${STRANGER}/planted')`,
    );
    expect(attempt.error, "an account could write into another account's library").toBeDefined();
  });
});

describe("deleting", () => {
  it("leaves a tombstone so the bytes are chased rather than orphaned", async () => {
    const id = await seed(OWNER, "notes.txt");
    const path = (
      await twin.asSuperuser<{ storage_path: string }>(
        `select storage_path from public.ocade_library_items where id = '${id}'`,
      )
    )[0]!.storage_path;

    await twin.asTenant(OWNER, `delete from public.ocade_library_items where id = '${id}'`);

    const tombstones = await twin.asSuperuser<{ storage_path: string; bucket: string }>(
      `select bucket, storage_path from public.storage_tombstones`,
    );
    expect(tombstones).toEqual([{ bucket: "library", storage_path: path }]);
  });

  it("empties the whole library for the caller and for nobody else", async () => {
    await seed(OWNER, "one.txt");
    await seed(OWNER, "two.txt");
    await seed(STRANGER, "theirs.txt");

    const removed = await twin.asTenant<{ ocade_delete_all_library_items: number }>(
      OWNER,
      `select public.ocade_delete_all_library_items()`,
    );
    expect(Number(removed.rows[0]!.ocade_delete_all_library_items)).toBe(2);

    const left = await twin.asSuperuser<{ user_id: string }>(
      `select user_id from public.ocade_library_items`,
    );
    expect(left.map((row) => row.user_id)).toEqual([STRANGER]);
  });

  it("takes the account's items with the account", async () => {
    await seed(OWNER, "one.txt");
    await twin.execSuperuser(`delete from auth.users where id = '${OWNER}'`);
    const left = await twin.asSuperuser<{ count: string }>(
      `select count(*) from public.ocade_library_items where user_id = '${OWNER}'`,
    );
    expect(Number(left[0]!.count)).toBe(0);
    // And the objects are still tracked for removal, because the trigger runs
    // during the cascade as well.
    const tombstones = await twin.asSuperuser<{ count: string }>(
      `select count(*) from public.storage_tombstones where bucket = 'library'`,
    );
    expect(Number(tombstones[0]!.count)).toBe(1);
    await twin.execSuperuser(
      `insert into auth.users (id, email) values ('${OWNER}', 'library-owner@invalid.test')`,
    );
  });
});

describe("what a library row may hold", () => {
  it("refuses a kind the interface cannot show", async () => {
    const attempt = await twin
      .asSuperuser(
        `insert into public.ocade_library_items (user_id, kind, source, name, mime, size_bytes, storage_path)
         values ('${OWNER}', 'video', 'upload', 'clip.mp4', 'video/mp4', 1, '${OWNER}/clip')`,
      )
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(attempt, "a library row accepted a kind nothing can render").not.toBeNull();
  });

  it("refuses a row naming another account's folder (F-044)", async () => {
    const attempt = await twin
      .asSuperuser(
        `insert into public.ocade_library_items (user_id, kind, source, name, mime, size_bytes, storage_path)
         values ('${OWNER}', 'file', 'upload', 'theirs.txt', 'text/plain', 1, '${STRANGER}/theirs')`,
      )
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(attempt, "a row pointed at another account's object").not.toBeNull();
  });

  it("refuses two rows pointing at one object", async () => {
    await twin.execSuperuser(
      `insert into public.ocade_library_items (user_id, kind, source, name, mime, size_bytes, storage_path)
       values ('${OWNER}', 'file', 'upload', 'one.txt', 'text/plain', 1, '${OWNER}/same')`,
    );
    const attempt = await twin
      .asSuperuser(
        `insert into public.ocade_library_items (user_id, kind, source, name, mime, size_bytes, storage_path)
         values ('${OWNER}', 'file', 'upload', 'two.txt', 'text/plain', 1, '${OWNER}/same')`,
      )
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(
      attempt,
      "two rows share one object, so deleting either breaks the other",
    ).not.toBeNull();
  });

  it("keeps a file when the conversation it came from is deleted", async () => {
    const conversation = (
      await twin.asSuperuser<{ id: string }>(
        `insert into public.ocade_conversations (user_id, title) values ('${OWNER}', 'A chat') returning id`,
      )
    )[0]!.id;
    await twin.execSuperuser(
      `insert into public.ocade_library_items (user_id, kind, source, name, mime, size_bytes, storage_path, conversation_id)
       values ('${OWNER}', 'file', 'generated', 'summary.txt', 'text/plain', 1, '${OWNER}/summary', '${conversation}')`,
    );

    await twin.execSuperuser(`delete from public.ocade_conversations where id = '${conversation}'`);

    const row = await twin.asSuperuser<{ conversation_id: string | null }>(
      `select conversation_id from public.ocade_library_items where storage_path = '${OWNER}/summary'`,
    );
    expect(row, "deleting a conversation deleted a file the person kept").toHaveLength(1);
    expect(row[0]!.conversation_id).toBeNull();
  });
});
