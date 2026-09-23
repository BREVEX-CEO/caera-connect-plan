import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../scripts/db-twin.mts";

/**
 * What a signed-in browser can no longer do, against real Postgres with every
 * migration applied: keep a deleted conversation (F09), write roles at any
 * assurance (F02), truncate a table past row-level security (F05), open a
 * permit for a retired surface (F27), or reach retired payment schema (F28).
 */
let twin: DatabaseTwin;

const OWNER = "55555555-eeee-4eee-8eee-555555555555";
const STRANGER = "66666666-ffff-4fff-8fff-666666666666";

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(applied.filter((m) => !m.ok).map((m) => `${m.file}: ${m.error}`)).toEqual([]);
  for (const [id, email] of [
    [OWNER, "closed-owner@invalid.test"],
    [STRANGER, "closed-stranger@invalid.test"],
  ]) {
    await twin.execSuperuser(
      `insert into auth.users (id, email) values ('${id}', '${email}') on conflict (id) do nothing`,
    );
  }
});

afterAll(async () => {
  await twin?.close();
});

async function conversationWithTurns(owner: string): Promise<string> {
  const [row] = await twin.asSuperuser<{ id: string }>(
    `insert into public.ocade_conversations (user_id, title) values ('${owner}', 'x') returning id`,
  );
  await twin.execSuperuser(
    `insert into public.ocade_messages (user_id, conversation_id, role, content)
     values ('${owner}', '${row!.id}', 'user', 'q'), ('${owner}', '${row!.id}', 'assistant', 'a')`,
  );
  return row!.id;
}

const count = async (sql: string) =>
  Number((await twin.asSuperuser<{ count: string }>(sql))[0]!.count);

describe("delete is for good", () => {
  it("removes the conversation and its messages in one statement", async () => {
    const id = await conversationWithTurns(OWNER);
    const result = await twin.asTenant(
      OWNER,
      `delete from public.ocade_conversations where id = '${id}' returning id`,
    );
    expect(result.rows).toHaveLength(1);
    expect(await count(`select count(*) from public.ocade_conversations where id = '${id}'`)).toBe(
      0,
    );
    expect(
      await count(`select count(*) from public.ocade_messages where conversation_id = '${id}'`),
    ).toBe(0);
  });

  it("cannot delete somebody else's conversation", async () => {
    const id = await conversationWithTurns(OWNER);
    const result = await twin.asTenant(
      STRANGER,
      `delete from public.ocade_conversations where id = '${id}' returning id`,
    );
    expect(result.rows).toHaveLength(0);
    expect(
      await count(`select count(*) from public.ocade_messages where conversation_id = '${id}'`),
    ).toBe(2);
  });

  it("has no trash left to restore from", async () => {
    expect(
      await count(
        `select count(*) from information_schema.columns
          where table_name = 'ocade_conversations' and column_name = 'deleted_at'`,
      ),
    ).toBe(0);
  });
});

describe("browser roles cannot write authority", () => {
  it("cannot grant itself a role, even as an admin", async () => {
    await twin.execSuperuser(
      `insert into public.user_roles (user_id, role) values ('${OWNER}', 'admin') on conflict do nothing`,
    );
    const attempt = await twin.asTenant(
      OWNER,
      `insert into public.user_roles (user_id, role) values ('${STRANGER}', 'admin')`,
      { aal: "aal2" },
    );
    expect(attempt.error).toBeDefined();
    const demote = await twin.asTenant(
      OWNER,
      `delete from public.user_roles where user_id = '${OWNER}'`,
      { aal: "aal2" },
    );
    expect(demote.error).toBeDefined();
  });

  it("cannot truncate past row-level security", async () => {
    for (const table of ["ocade_messages", "user_roles", "ocade_entitlement_grants"]) {
      const attempt = await twin.asTenant(OWNER, `truncate public.${table}`);
      expect(attempt.error, `authenticated truncated ${table}`).toBeDefined();
    }
  });

  it("cannot write its own entitlement or usage rows", async () => {
    const grant = await twin.asTenant(
      OWNER,
      `insert into public.ocade_entitlement_grants (user_id, granted_by, tier, reason, ends_at)
       values ('${OWNER}', '${OWNER}', 'max', 'I would like Max', now() + interval '1 day')`,
    );
    expect(grant.error).toBeDefined();
  });

  it("opens permits for Chat only", async () => {
    const insert = (surface: string) =>
      twin.asSuperuser(
        `insert into public.ocade_generation_permits
           (user_id, idempotency_key, generation_id, surface, tier, status, reserved_hundredths,
            session_limit_hundredths, session_window_start, session_reset_at,
            week_window_start, week_reset_at, issued_at, expires_at)
         values ('${OWNER}', 'k-${surface}', 'g-${surface}', '${surface}', 'free', 'reserved', 100,
            2800, now(), now() + interval '1 hour', now(), now() + interval '7 days',
            now(), now() + interval '30 minutes')`,
      );
    await expect(insert("cowork")).rejects.toThrow(/surface_check/);
    await expect(insert("chat")).resolves.toBeDefined();
  });

  it("has no retired payment schema to reach", async () => {
    expect(
      await count(
        `select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relname in ('subscriptions', 'ocade_invoices', 'ocade_payment_events',
                              'payment_webhook_events')`,
      ),
    ).toBe(0);
  });
});
