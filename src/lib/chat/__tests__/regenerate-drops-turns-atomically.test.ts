import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";

/**
 * REGENERATE, AGAINST REAL POSTGRES.
 *
 * Edit, Regenerate and Retry all drop a question and every turn after it. The
 * browser did that one row at a time, in parallel, so one refused deletion among
 * five left the account's transcript missing turns from the MIDDLE — and a
 * deleted message has no undo. The recovery was to re-read whatever remained and
 * hope it made sense.
 *
 * "One statement, so all or none" is a claim only a real database can answer,
 * and it is the claim the whole repair rests on. Everything below runs as
 * `authenticated` with a JWT claim, the way PostgREST executes a customer's
 * request, so `own_messages` is in force exactly as it is in production.
 */
let twin: DatabaseTwin;

const OWNER = "33333333-cccc-4ccc-8ccc-333333333333";
const STRANGER = "44444444-dddd-4ddd-8ddd-444444444444";

async function conversation(owner: string): Promise<string> {
  const rows = await twin.asSuperuser<{ id: string }>(
    `insert into public.ocade_conversations (user_id, title) values ('${owner}', 'Regenerate')
     returning id`,
  );
  return rows[0]!.id;
}

/** Turns one minute apart, so "at or after this moment" has a real boundary. */
async function turns(owner: string, id: string, count: number): Promise<string[]> {
  // As text, because the driver hands back a `Date` whose string form Postgres
  // then refuses to parse on the way in again.
  const rows = await twin.asSuperuser<{ at: string }>(
    `insert into public.ocade_messages (user_id, conversation_id, role, content, created_at)
     select '${owner}', '${id}',
            case when n % 2 = 0 then 'user' else 'assistant' end,
            'turn ' || n,
            now() - make_interval(mins => ${count} - n)
       from generate_series(1, ${count}) as n
     returning created_at::text as at`,
  );
  return rows.map((row) => row.at);
}

const contentsOf = async (id: string) =>
  (
    await twin.asSuperuser<{ content: string }>(
      `select content from public.ocade_messages where conversation_id = '${id}'
        order by created_at`,
    )
  ).map((row) => row.content);

const truncate = (user: string, id: string, from: string) =>
  twin.asTenant<{ ocade_delete_messages_from: number }>(
    user,
    `select public.ocade_delete_messages_from('${id}', '${from}'::timestamptz)`,
  );

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(applied.filter((migration) => !migration.ok).map((migration) => migration.file)).toEqual(
    [],
  );
  await twin.execSuperuser(
    `insert into auth.users (id, email) values
       ('${OWNER}', 'regen-owner@invalid.test'), ('${STRANGER}', 'regen-stranger@invalid.test')
     on conflict (id) do nothing`,
  );
}, 180_000);

afterAll(async () => {
  await twin?.close();
});

describe("dropping a question and everything after it", () => {
  it("removes exactly the turns from that moment on", async () => {
    const id = await conversation(OWNER);
    const times = await turns(OWNER, id, 5);

    const result = await truncate(OWNER, id, times[2]!);
    expect(result.error).toBeUndefined();
    expect(result.rows[0]?.ocade_delete_messages_from).toBe(3);
    expect(await contentsOf(id)).toEqual(["turn 1", "turn 2"]);
  });

  it("removes all of them or none, which is the whole point", async () => {
    const id = await conversation(OWNER);
    const times = await turns(OWNER, id, 5);

    /*
     * Refuse a deletion the way a policy or a constraint would, part way
     * through the set. The old client had already deleted the earlier turns by
     * separate calls before it reached this one; one statement has not deleted
     * anything until it has deleted all of it.
     */
    await twin.execSuperuser(`
      create or replace function public.refuse_one_turn() returns trigger
        language plpgsql as $$ begin
          if old.content = 'turn 4' then raise exception 'deletion refused'; end if;
          return old;
        end $$;
      create trigger refuse_one_turn before delete on public.ocade_messages
        for each row execute function public.refuse_one_turn();
    `);

    const refused = await truncate(OWNER, id, times[1]!);
    expect(refused.error).toMatch(/deletion refused/);
    // Not one turn fewer than it started with.
    expect(await contentsOf(id)).toEqual(["turn 1", "turn 2", "turn 3", "turn 4", "turn 5"]);

    await twin.execSuperuser(`
      drop trigger if exists refuse_one_turn on public.ocade_messages;
      drop function if exists public.refuse_one_turn();
    `);
  });

  it("cannot be turned on somebody else's conversation", async () => {
    const id = await conversation(OWNER);
    const times = await turns(OWNER, id, 3);

    const attempt = await truncate(STRANGER, id, times[0]!);
    // Runs as its caller, so row-level security simply shows it nothing.
    expect(attempt.error).toBeUndefined();
    expect(attempt.rows[0]?.ocade_delete_messages_from).toBe(0);
    expect(await contentsOf(id)).toEqual(["turn 1", "turn 2", "turn 3"]);
  });

  it("refuses a call with no conversation or no starting time", async () => {
    const missing = await twin.asTenant(
      OWNER,
      `select public.ocade_delete_messages_from(null, now())`,
    );
    expect(missing.error).toMatch(/conversation and a starting time/);
  });
});
