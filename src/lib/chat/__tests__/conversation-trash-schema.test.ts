import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";

/**
 * THE TRASH, AGAINST REAL POSTGRES.
 *
 * A trash is a promise: "this is recoverable for a while, and then it is not."
 * Both halves can fail silently and both failures are somebody's conversations.
 * Purge too eagerly and the undo was a lie; purge never and "deleted" means
 * nothing, which is its own broken promise to anybody who deleted something
 * because they wanted it gone.
 *
 * The migration's own verification covers the boundary — a row at thirty-one
 * days goes, a row at zero days stays. What is proved here is the part that
 * needs a SECOND ACCOUNT to be provable at all: that the trash is per-account
 * in every direction. `ocade_purge_expired_conversation_trash` is SECURITY
 * DEFINER, so it runs as the table's owner and row-level security does not
 * apply to it; the `user_id = auth.uid()` predicate inside it is the entire
 * access control, and a test that only ever uses one account cannot tell a
 * working predicate from a missing one.
 */

let twin: DatabaseTwin;

const OWNER = "11111111-aaaa-4aaa-8aaa-111111111111";
const STRANGER = "22222222-bbbb-4bbb-8bbb-222222222222";

async function seed(owner: string, title: string, deletedAt: string | null): Promise<string> {
  const rows = await twin.asSuperuser<{ id: string }>(
    `insert into public.ocade_conversations (user_id, title, deleted_at)
     values ('${owner}', '${title.replaceAll("'", "''")}',
             ${deletedAt === null ? "null" : `${deletedAt}`})
     returning id`,
  );
  return rows[0]!.id;
}

async function exists(id: string): Promise<boolean> {
  const rows = await twin.asSuperuser<{ count: string }>(
    `select count(*) from public.ocade_conversations where id = '${id}'`,
  );
  return Number(rows[0]!.count) === 1;
}

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(
    applied.filter((migration) => !migration.ok).map((migration) => migration.file),
    "a migration failed",
  ).toEqual([]);

  for (const [id, email] of [
    [OWNER, "trash-owner@invalid.test"],
    [STRANGER, "trash-stranger@invalid.test"],
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
  await twin.execSuperuser(`delete from public.ocade_conversations`);
});

describe("what the sidebar sees", () => {
  it("hides a trashed conversation from its owner's ordinary list", async () => {
    await seed(OWNER, "Still here", null);
    await seed(OWNER, "In the trash", "now()");

    const rows = await twin.asTenant<{ title: string }>(
      OWNER,
      `select title from public.ocade_conversations where deleted_at is null order by title`,
    );
    expect(rows.rows.map((row) => row.title)).toEqual(["Still here"]);
  });

  it("shows it again the moment it is restored", async () => {
    const id = await seed(OWNER, "Back from the trash", "now()");
    const restored = await twin.asTenant(
      OWNER,
      `update public.ocade_conversations set deleted_at = null where id = '${id}'`,
    );
    expect(restored.error).toBeUndefined();

    const rows = await twin.asTenant<{ title: string }>(
      OWNER,
      `select title from public.ocade_conversations where deleted_at is null`,
    );
    expect(rows.rows.map((row) => row.title)).toEqual(["Back from the trash"]);
  });

  it("keeps a restored conversation archived if that is where it was left", async () => {
    /*
     * Restoring clears `deleted_at` and nothing else. Somebody who archived a
     * conversation, trashed it and then changed their mind gets back what they
     * had — not a conversation that reappears at the top of the active list.
     */
    const rows = await twin.asSuperuser<{ id: string }>(
      `insert into public.ocade_conversations (user_id, title, archived, deleted_at)
       values ('${OWNER}', 'Archived then trashed', true, now()) returning id`,
    );
    const id = rows[0]!.id;
    await twin.asTenant(
      OWNER,
      `update public.ocade_conversations set deleted_at = null where id = '${id}'`,
    );
    const after = await twin.asSuperuser<{ archived: boolean }>(
      `select archived from public.ocade_conversations where id = '${id}'`,
    );
    expect(after[0]!.archived).toBe(true);
  });
});

describe("the trash is one account's", () => {
  it("does not show one account's trash to another", async () => {
    await seed(OWNER, "Owner's trashed chat", "now()");
    const rows = await twin.asTenant(
      STRANGER,
      `select id from public.ocade_conversations where deleted_at is not null`,
    );
    expect(rows.rows).toHaveLength(0);
  });

  it("purges only the caller's lapsed rows, never anybody else's", async () => {
    /*
     * THE ASSERTION THIS FILE EXISTS FOR. The purge is SECURITY DEFINER: it
     * runs as the table's owner, so RLS does not stop it and the `user_id =
     * auth.uid()` line inside it is the only thing that does. Both accounts
     * hold a row that is well past the undo period; one of them calls the
     * purge; exactly one row may go.
     */
    const mine = await seed(OWNER, "Mine, long lapsed", "now() - interval '90 days'");
    const theirs = await seed(STRANGER, "Theirs, long lapsed", "now() - interval '90 days'");

    const purged = await twin.asTenant<{ ocade_purge_expired_conversation_trash: number }>(
      OWNER,
      `select public.ocade_purge_expired_conversation_trash()`,
    );
    expect(purged.error).toBeUndefined();
    expect(Number(purged.rows[0]!.ocade_purge_expired_conversation_trash)).toBe(1);

    expect(await exists(mine), "the caller's lapsed row survived its own purge").toBe(false);
    expect(await exists(theirs), "another account's conversation was purged").toBe(true);
  });

  it("cannot be told which account to purge", async () => {
    // There is no argument to pass. A function that took a user id would let
    // any signed-in caller empty somebody else's trash, and this is the shape
    // that makes that unwritable rather than merely unwritten.
    const rows = await twin.asSuperuser<{ args: string }>(
      `select pg_get_function_identity_arguments(oid) as args
         from pg_proc
        where pronamespace = 'public'::regnamespace
          and proname = 'ocade_purge_expired_conversation_trash'`,
    );
    expect(rows[0]!.args).toBe("");
  });
});

describe("the undo period", () => {
  it("is one number the database owns", async () => {
    const rows = await twin.asTenant<{ ocade_conversation_trash_days: number }>(
      OWNER,
      `select public.ocade_conversation_trash_days()`,
    );
    expect(Number(rows.rows[0]!.ocade_conversation_trash_days)).toBe(30);
  });

  it("spares a row one day short of it and takes one a day past", async () => {
    const spared = await seed(OWNER, "Twenty-nine days ago", "now() - interval '29 days'");
    const taken = await seed(OWNER, "Thirty-one days ago", "now() - interval '31 days'");

    await twin.asTenant(OWNER, `select public.ocade_purge_expired_conversation_trash()`);

    expect(await exists(spared), "a conversation still inside the undo period was purged").toBe(
      true,
    );
    expect(await exists(taken), "a conversation past the undo period survived").toBe(false);
  });
});
