import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../scripts/db-twin.mts";

/**
 * THE INVARIANT EVERYTHING ELSE RESTS ON, TESTED DIRECTLY.
 *
 * "Account A can never observe account B's data" is the first hard invariant in
 * `docs/TESTING.md`, and until now no suite asserted it for the two tables that
 * hold what a person actually writes. `security-definer.test.ts` even refers to
 * a `user-isolation.test.ts` — a file that is not in this repository. Library
 * had a policy test; conversations and their messages had one assertion about
 * trash purging and nothing else.
 *
 * WHAT MAKES THIS WORTH ANYTHING: every statement below runs under `SET ROLE
 * authenticated` with a JWT claim, which is how PostgREST executes a customer's
 * request. A superuser bypasses row-level security entirely, so the same test
 * run as the twin's owner would pass against completely broken policies.
 *
 * The reads assert EMPTINESS rather than an error, because that is what RLS
 * does: a policy does not refuse a select, it makes the rows invisible. A write
 * is refused, and the checks say which of the two each case should be.
 */
let twin: DatabaseTwin;
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let conversation: string;
let message: string;

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(applied.filter((migration) => !migration.ok).map((m) => m.file)).toEqual([]);

  await twin.execSuperuser(
    `insert into auth.users (id, email) values
       ('${A}', 'a@ocade.invalid'), ('${B}', 'b@ocade.invalid')
     on conflict do nothing;`,
  );

  // Written AS A, through the same role and policies a real request uses, so
  // the rows under test were created the way production creates them.
  const created = await twin.asTenant<{ id: string }>(
    A,
    `insert into public.ocade_conversations (user_id, title)
     values ('${A}', 'A private conversation') returning id`,
  );
  expect(created.error).toBeUndefined();
  conversation = created.rows[0]!.id;

  const wrote = await twin.asTenant<{ id: string }>(
    A,
    `insert into public.ocade_messages (conversation_id, user_id, role, content)
     values ('${conversation}', '${A}', 'user', 'something private') returning id`,
  );
  expect(wrote.error).toBeUndefined();
  message = wrote.rows[0]!.id;
}, 180_000);

afterAll(async () => {
  await twin?.close();
});

describe("a conversation belongs to one account", () => {
  it("is readable by the account that wrote it", async () => {
    const mine = await twin.asTenant(
      A,
      `select id from public.ocade_conversations where id = '${conversation}'`,
    );
    // The control. Without it, every check below could pass because nothing is
    // readable by anybody.
    expect(mine.rows).toHaveLength(1);
  });

  it("is invisible to another account", async () => {
    const theirs = await twin.asTenant(
      B,
      `select id, title from public.ocade_conversations where id = '${conversation}'`,
    );
    expect(theirs.rows).toEqual([]);
  });

  it("cannot be renamed, archived or deleted by another account", async () => {
    await twin.asTenant(
      B,
      `update public.ocade_conversations set title = 'taken' where id = '${conversation}'`,
    );
    await twin.asTenant(B, `delete from public.ocade_conversations where id = '${conversation}'`);
    const after = await twin.asTenant<{ title: string }>(
      A,
      `select title from public.ocade_conversations where id = '${conversation}'`,
    );
    expect(after.rows[0]?.title).toBe("A private conversation");
  });

  it("cannot be claimed by inserting a row that names another account", async () => {
    const forged = await twin.asTenant(
      B,
      `insert into public.ocade_conversations (user_id, title) values ('${A}', 'forged')`,
    );
    expect(forged.error, "one account inserted a conversation owned by another").toBeDefined();
  });
});

describe("the messages inside it", () => {
  it("are invisible to another account", async () => {
    const theirs = await twin.asTenant(
      B,
      `select id, content from public.ocade_messages where conversation_id = '${conversation}'`,
    );
    expect(theirs.rows).toEqual([]);
  });

  it("cannot be deleted by another account", async () => {
    await twin.asTenant(B, `delete from public.ocade_messages where id = '${message}'`);
    const still = await twin.asTenant(
      A,
      `select id from public.ocade_messages where id = '${message}'`,
    );
    expect(still.rows, "another account deleted a message").toHaveLength(1);
  });

  it("cannot be added to by another account, under either owner", async () => {
    // Naming themselves as the owner is the interesting one: the row would be
    // theirs, but it would appear inside somebody else's transcript.
    const asThemselves = await twin.asTenant(
      B,
      `insert into public.ocade_messages (conversation_id, user_id, role, content)
       values ('${conversation}', '${B}', 'user', 'injected')`,
    );
    const asOwner = await twin.asTenant(
      B,
      `insert into public.ocade_messages (conversation_id, user_id, role, content)
       values ('${conversation}', '${A}', 'user', 'forged')`,
    );
    expect(asOwner.error, "one account wrote a message owned by another").toBeDefined();

    const seen = await twin.asTenant<{ content: string }>(
      A,
      `select content from public.ocade_messages where conversation_id = '${conversation}'`,
    );
    expect(
      seen.rows.map((row) => row.content),
      `another account's turn appeared in this transcript (${asThemselves.error ?? "insert allowed"})`,
    ).toEqual(["something private"]);
  });
});

describe("what an account may read about itself", () => {
  it("cannot read another account's usage", async () => {
    await twin.execSuperuser(
      `insert into public.ocade_commercial_usage
         (user_id, window_kind, window_start, used_hundredths)
       values ('${A}', 'session', now(), 500)
       on conflict do nothing;`,
    );
    const theirs = await twin.asTenant(
      B,
      `select used_hundredths from public.ocade_commercial_usage where user_id = '${A}'`,
    );
    expect(theirs.rows).toEqual([]);
  });

  it("cannot grant itself an entitlement", async () => {
    const forged = await twin.asTenant(
      B,
      `insert into public.ocade_entitlement_grants (user_id, tier, reason)
       values ('${B}', 'max', 'self service')`,
    );
    expect(forged.error, "an account granted itself a paid tier").toBeDefined();
  });
});
