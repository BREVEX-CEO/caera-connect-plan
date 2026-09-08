import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";

/**
 * SHARING A CONVERSATION, AGAINST REAL POSTGRESQL — PLAN.md §8.
 *
 * This is the one §8 capability that hands somebody's own words to a visitor
 * with no account, so it is the one where a policy that protects nothing is
 * most expensive. Every request below runs under `SET ROLE authenticated` or
 * `anon`; a superuser probe would pass against a table with no row-level
 * security at all and prove precisely nothing.
 *
 * The four properties that matter, and each is tested by trying to break it:
 * the share is a SNAPSHOT and does not keep publishing what came next; a
 * device-only conversation is refused rather than shared empty; nobody can
 * share or revoke a conversation that is not theirs; and a dead link is
 * indistinguishable from a link that never existed.
 */

const OWNER = "aa000000-0000-4000-8000-000000000001";
const STRANGER = "bb000000-0000-4000-8000-000000000002";

let twin: DatabaseTwin;

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(
    applied.filter((m) => !m.ok).map((m) => `${m.file}: ${m.error}`),
    "a migration failed",
  ).toEqual([]);

  for (const [id, email] of [
    [OWNER, "owner@example.com"],
    [STRANGER, "stranger@example.com"],
  ]) {
    await twin.execSuperuser(
      `insert into auth.users (id, email) values ('${id}', '${email}')
       on conflict (id) do nothing`,
    );
  }
});

afterAll(async () => {
  await twin?.close();
});

beforeEach(async () => {
  await twin.execSuperuser(`delete from public.ocade_conversations`);
});

/** A synchronised conversation with `turns` messages, owned by `owner`. */
async function seedConversation(
  owner: string,
  turns: string[],
  privacyMode = "private_sync",
): Promise<string> {
  const rows = await twin.asSuperuser<{ id: string }>(
    `insert into public.ocade_conversations (user_id, title, privacy_mode)
     values ('${owner}', 'How the tides work', '${privacyMode}')
     returning id`,
  );
  const id = rows[0]!.id;
  for (const [index, content] of turns.entries()) {
    await twin.execSuperuser(
      `insert into public.ocade_messages (conversation_id, user_id, role, content, created_at)
       values ('${id}', '${owner}', '${index % 2 === 0 ? "user" : "assistant"}',
               ${quote(content)}, now() + interval '${index} seconds')`,
    );
  }
  return id;
}

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

async function share(actor: string, conversationId: string, expiresAt: string | null = null) {
  return twin.asTenant<{ ocade_share_conversation: string }>(
    actor,
    `select public.ocade_share_conversation('${conversationId}',
       ${expiresAt ? `'${expiresAt}'::timestamptz` : "null"})`,
  );
}

async function readShare(token: string) {
  return twin.asAnon<{ title: string; messages: unknown[]; message_count: number }>(
    `select * from public.ocade_read_shared_conversation(${quote(token)})`,
  );
}

describe("a share is a snapshot, not a window onto the conversation", () => {
  it("publishes what was said when it was shared, and nothing said afterwards", async () => {
    const conversation = await seedConversation(OWNER, ["What are tides?", "The moon."]);
    const created = await share(OWNER, conversation);
    expect(created.error).toBeUndefined();
    const token = created.rows[0]!.ocade_share_conversation;

    await twin.execSuperuser(
      `insert into public.ocade_messages (conversation_id, user_id, role, content, created_at)
       values ('${conversation}', '${OWNER}', 'user',
               'And my bank details are 1234', now() + interval '10 seconds')`,
    );

    const read = await readShare(token);
    /*
     * THE ASSERTION THE WHOLE DESIGN EXISTS FOR. A live view would publish
     * everything said after the share with no further decision from the person
     * who shared it — they carry on in the same thread and every later message
     * is on a public link.
     */
    expect(read.rows[0]!.message_count).toBe(2);
    expect(JSON.stringify(read.rows[0]!.messages)).not.toContain("bank details");
  });

  it("re-sharing refreshes the snapshot and keeps the link working", async () => {
    const conversation = await seedConversation(OWNER, ["One", "Two"]);
    const first = (await share(OWNER, conversation)).rows[0]!.ocade_share_conversation;
    await twin.execSuperuser(
      `insert into public.ocade_messages (conversation_id, user_id, role, content, created_at)
       values ('${conversation}', '${OWNER}', 'user', 'Three', now() + interval '10 seconds')`,
    );
    const second = (await share(OWNER, conversation)).rows[0]!.ocade_share_conversation;

    // A link somebody has already sent must not stop working because its owner
    // updated what it shows.
    expect(second).toBe(first);
    expect((await readShare(first)).rows[0]!.message_count).toBe(3);
  });

  it("never carries an attachment's name, only that there was one", async () => {
    const conversation = await seedConversation(OWNER, ["Read this", "Done"]);
    await twin.execSuperuser(
      `update public.ocade_messages
          set attachments = '[{"kind":"file","name":"severance-agreement.pdf","mime":"application/pdf","sizeBytes":10}]'::jsonb
        where conversation_id = '${conversation}' and role = 'user'`,
    );
    const token = (await share(OWNER, conversation)).rows[0]!.ocade_share_conversation;
    const read = await readShare(token);
    const body = JSON.stringify(read.rows[0]!.messages);
    /*
     * "Share this conversation" is not consent to publish the documents read
     * during it, and a file name alone can disclose more than the conversation.
     */
    expect(body).not.toContain("severance-agreement");
    expect(body).toContain('"attachment_count":1');
  });
});

describe("a conversation that lives on the device cannot be shared", () => {
  for (const mode of ["browser_only", "pc_vault"]) {
    it(`refuses ${mode} rather than publishing an empty transcript`, async () => {
      const conversation = await seedConversation(OWNER, ["Local only"], mode);
      const attempt = await share(OWNER, conversation);
      /*
       * The messages of a device-only conversation are not in this database, so
       * a share built from `ocade_messages` would be an empty transcript
       * published under a real title — a silent wrong answer, which is worse
       * than a refusal.
       */
      expect(attempt.error).toBeDefined();
      expect(attempt.errorDetail).toBe("conversation_not_synchronised");
    });
  }

  it("refuses a conversation with nothing in it", async () => {
    const conversation = await seedConversation(OWNER, []);
    const attempt = await share(OWNER, conversation);
    expect(attempt.errorDetail).toBe("conversation_empty");
  });
});

describe("only the owner may share or stop sharing", () => {
  it("refuses a stranger, and says the same thing it says for a conversation that does not exist", async () => {
    const conversation = await seedConversation(OWNER, ["Mine", "Indeed"]);
    const attempt = await share(STRANGER, conversation);
    expect(attempt.errorDetail).toBe("not_found_or_forbidden");

    const missing = await share(STRANGER, "00000000-0000-4000-8000-0000000000ff");
    /*
     * IDENTICAL, DELIBERATELY. A distinguishable "not yours" would let anybody
     * test whether a given conversation id exists on the platform.
     */
    expect(missing.errorDetail).toBe("not_found_or_forbidden");
  });

  it("does not let a stranger revoke somebody's share", async () => {
    const conversation = await seedConversation(OWNER, ["Mine", "Indeed"]);
    const token = (await share(OWNER, conversation)).rows[0]!.ocade_share_conversation;

    const attempt = await twin.asTenant<{ ocade_revoke_conversation_share: number }>(
      STRANGER,
      `select public.ocade_revoke_conversation_share('${conversation}')`,
    );
    /*
     * The function runs as the table's owner and so bypasses the read policy
     * entirely: the `owner_id = actor` predicate inside it IS the access
     * control, and this is what proves it is there.
     */
    expect(attempt.error).toBeUndefined();
    expect(Number(attempt.rows[0]!.ocade_revoke_conversation_share)).toBe(0);
    expect((await readShare(token)).rows).toHaveLength(1);
  });

  it("cannot read another account's shares out of the table", async () => {
    const conversation = await seedConversation(OWNER, ["Mine", "Indeed"]);
    await share(OWNER, conversation);
    const rows = await twin.asTenant(STRANGER, `select * from public.ocade_conversation_shares`);
    expect(rows.rows).toHaveLength(0);
  });
});

describe("a dead link", () => {
  it("returns nothing once revoked, and does not admit it was ever real", async () => {
    const conversation = await seedConversation(OWNER, ["One", "Two"]);
    const token = (await share(OWNER, conversation)).rows[0]!.ocade_share_conversation;
    expect((await readShare(token)).rows).toHaveLength(1);

    const stopped = await twin.asTenant<{ ocade_revoke_conversation_share: number }>(
      OWNER,
      `select public.ocade_revoke_conversation_share('${conversation}')`,
    );
    expect(Number(stopped.rows[0]!.ocade_revoke_conversation_share)).toBe(1);

    const revoked = await readShare(token);
    const neverExisted = await readShare("0".repeat(48));
    // Indistinguishable. A "this was revoked" answer would confirm the link had
    // once been real, which the holder of a dead link is not owed.
    expect(revoked.rows).toEqual(neverExisted.rows);
    expect(revoked.rows).toHaveLength(0);
  });

  it("stops working at its expiry without anybody revoking it", async () => {
    const conversation = await seedConversation(OWNER, ["One", "Two"]);
    const token = (await share(OWNER, conversation, "2020-01-01T00:00:00Z")).rows[0]
      ?.ocade_share_conversation;
    expect(token).toBeUndefined();
  });

  it("expires on its own once the moment passes", async () => {
    const conversation = await seedConversation(OWNER, ["One", "Two"]);
    const token = (await share(OWNER, conversation)).rows[0]!.ocade_share_conversation;
    await twin.execSuperuser(
      `update public.ocade_conversation_shares
          set expires_at = now() - interval '1 second'
        where token = ${quote(token)}`,
    );
    expect((await readShare(token)).rows).toHaveLength(0);
  });

  it("dies with the conversation it copied", async () => {
    const conversation = await seedConversation(OWNER, ["One", "Two"]);
    const token = (await share(OWNER, conversation)).rows[0]!.ocade_share_conversation;
    /*
     * Delete-all removes conversations, and a share that outlived one would be
     * exactly what somebody clearing their history was trying to prevent.
     */
    await twin.execSuperuser(`delete from public.ocade_conversations where id = '${conversation}'`);
    expect((await readShare(token)).rows).toHaveLength(0);
  });

  it("allows a second link only after the first is revoked", async () => {
    const conversation = await seedConversation(OWNER, ["One", "Two"]);
    const first = (await share(OWNER, conversation)).rows[0]!.ocade_share_conversation;
    await twin.asTenant(OWNER, `select public.ocade_revoke_conversation_share('${conversation}')`);
    const second = (await share(OWNER, conversation)).rows[0]!.ocade_share_conversation;
    expect(second).not.toBe(first);
    // Revoking meant it, and re-sharing did not resurrect the old link.
    expect((await readShare(first)).rows).toHaveLength(0);
    expect((await readShare(second)).rows).toHaveLength(1);
  });
});

describe("the token", () => {
  it("is long and random, not a countable identifier", async () => {
    const first = await seedConversation(OWNER, ["A", "B"]);
    const second = await seedConversation(OWNER, ["C", "D"]);
    const a = (await share(OWNER, first)).rows[0]!.ocade_share_conversation;
    const b = (await share(OWNER, second)).rows[0]!.ocade_share_conversation;
    expect(a).toMatch(/^[0-9a-f]{48}$/);
    expect(b).not.toBe(a);
  });
});
