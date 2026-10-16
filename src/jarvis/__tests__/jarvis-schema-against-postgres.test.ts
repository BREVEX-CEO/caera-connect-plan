import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../scripts/db-twin.mts";

/**
 * The JARVIS data authority, proved against real PostgreSQL with the real
 * migrations and policies. Every tenant statement runs as `authenticated`.
 */
let twin: DatabaseTwin;
const A = "aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-2222-4bbb-8bbb-bbbbbbbbbbbb";
let chat: string;
let jarvis: string;
let device: string;
let task: string;

async function permit(user: string, key: string, surface: "chat" | "jarvis", limit = 200) {
  const [row] = await twin.asServiceRole<{ outcome: string }>(
    `select outcome from public.ocade_acquire_generation_permit(
       '${user}'::uuid, '${key}', '${key}', '${surface}', 'free', ${limit}, null, 100)`,
  );
  return row!.outcome;
}

/** A service-role write, reporting the refusal instead of throwing. */
const serviceWrite = (sql: string) =>
  twin.asServiceRole(sql).then(
    () => ({ errorCode: undefined as string | undefined }),
    (error: { code?: string }) => ({ errorCode: error.code }),
  );

async function used(user: string, surface: "chat" | "jarvis") {
  const rows = await twin.asServiceRole<{ window_kind: string; used: string; held: string }>(
    `select window_kind, used_hundredths as used, reserved_hundredths as held
       from public.ocade_read_commercial_usage('${user}'::uuid, '${surface}')`,
  );
  const session = rows.find((row) => row.window_kind === "session")!;
  return Number(session.used) + Number(session.held);
}

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(applied.filter((m) => !m.ok).map((m) => `${m.file}: ${m.error}`)).toEqual([]);
  await twin.execSuperuser(
    `insert into auth.users (id, email) values
       ('${A}', 'a@jarvis.invalid'), ('${B}', 'b@jarvis.invalid') on conflict do nothing;`,
  );
  chat = (
    await twin.asTenant<{ id: string }>(
      A,
      `insert into public.ocade_conversations (user_id, title) values ('${A}', 'chat') returning id`,
    )
  ).rows[0]!.id;
  jarvis = (
    await twin.asTenant<{ id: string }>(
      A,
      `insert into public.ocade_conversations (user_id, title, surface)
       values ('${A}', 'jarvis', 'jarvis') returning id`,
    )
  ).rows[0]!.id;
  [{ id: device }] = await twin.asServiceRole<{ id: string }>(
    `insert into public.jarvis_devices (user_id, name, public_key)
     values ('${A}', 'Laptop', repeat('k', 122)) returning id`,
  );
}, 240_000);

afterAll(async () => {
  await twin?.close();
});

describe("the migration", () => {
  it.each([
    "20260926090000_ocade_jarvis_web_verify.sql",
    "20260927090000_jarvis_device_identity_verify.sql",
  ])("passes %s", async (file) => {
    const result = await twin.runScript("supabase/verification", file);
    expect(result.error).toBeUndefined();
    expect(result.ok).toBe(true);
  });
});

describe("one conversation authority, two surfaces", () => {
  it("defaults existing and new conversations to Chat", async () => {
    const { rows } = await twin.asTenant<{ surface: string }>(
      A,
      `select surface from public.ocade_conversations where id = '${chat}'`,
    );
    expect(rows[0]!.surface).toBe("chat");
  });

  it("refuses to move a conversation between surfaces", async () => {
    const moved = await twin.asTenant(
      A,
      `update public.ocade_conversations set surface = 'jarvis' where id = '${chat}'`,
    );
    expect(moved.error).toMatch(/cannot change surface/);
  });

  it("refuses an unknown surface", async () => {
    const bad = await twin.asTenant(
      A,
      `insert into public.ocade_conversations (user_id, surface) values ('${A}', 'cowork')`,
    );
    expect(bad.errorCode).toBe("23514");
  });
});

describe("tasks", () => {
  it("belong only to a JARVIS conversation of the same account", async () => {
    const inChat = await twin.asTenant(
      A,
      `insert into public.jarvis_tasks (user_id, conversation_id, title)
       values ('${A}', '${chat}', 'x')`,
    );
    expect(inChat.error).toBeDefined();

    const forged = await twin.asTenant(
      B,
      `insert into public.jarvis_tasks (user_id, conversation_id, title)
       values ('${B}', '${jarvis}', 'x')`,
    );
    expect(forged.error).toBeDefined();

    const ok = await twin.asTenant<{ id: string }>(
      A,
      `insert into public.jarvis_tasks (user_id, conversation_id, device_id, title, plan, live_frame)
       values ('${A}', '${jarvis}', '${device}', 'Find a page', '["open","read"]', 'frame')
       returning id`,
    );
    expect(ok.error).toBeUndefined();
    task = ok.rows[0]!.id;
  });

  it("allow only one unfinished task per device, whichever conversation asks", async () => {
    const other = (
      await twin.asTenant<{ id: string }>(
        A,
        `insert into public.ocade_conversations (user_id, title, surface)
         values ('${A}', 'other', 'jarvis') returning id`,
      )
    ).rows[0]!.id;
    const second = await twin.asTenant(
      A,
      `insert into public.jarvis_tasks (user_id, conversation_id, device_id, title)
       values ('${A}', '${other}', '${device}', 'Also on the laptop')`,
    );
    expect(second.errorCode).toBe("23505");
    await twin.asSuperuser(`delete from public.ocade_conversations where id = '${other}'`);
  });

  it("allow only one unfinished task per conversation", async () => {
    const second = await twin.asTenant(
      A,
      `insert into public.jarvis_tasks (user_id, conversation_id, title)
       values ('${A}', '${jarvis}', 'Second')`,
    );
    expect(second.errorCode).toBe("23505");
  });

  it("drops the temporary frame when the task stops and keeps the result", async () => {
    await twin.asTenant(
      A,
      `update public.jarvis_tasks set status = 'stopped', result = 'Done: 3 results'
        where id = '${task}'`,
    );
    const [row] = await twin.asSuperuser<{
      live_frame: string | null;
      finished_at: string | null;
      result: string;
    }>(`select live_frame, finished_at, result from public.jarvis_tasks where id = '${task}'`);
    expect(row!.live_frame).toBeNull();
    expect(row!.finished_at).not.toBeNull();
    expect(row!.result).toBe("Done: 3 results");
  });

  it("are invisible to another account", async () => {
    const { rows } = await twin.asTenant(B, `select id from public.jarvis_tasks`);
    expect(rows).toEqual([]);
  });
});

describe("devices", () => {
  it("never expose key material or the replay counter to a browser role", async () => {
    for (const column of ["public_key", "last_request_ms"]) {
      const hidden = await twin.asTenant(A, `select ${column} from public.jarvis_devices`);
      expect(hidden.errorCode).toBe("42501");
    }
    const safe = await twin.asTenant<{ name: string }>(
      A,
      `select id, name from public.jarvis_devices`,
    );
    expect(safe.rows.map((r) => r.name)).toEqual(["Laptop"]);
  });

  it("cannot be written or revived by a browser role", async () => {
    const revive = await twin.asTenant(
      A,
      `update public.jarvis_devices set revoked_at = null where id = '${device}'`,
    );
    expect(revive.errorCode).toBe("42501");
  });

  it("are invisible to another account", async () => {
    const { rows } = await twin.asTenant(B, `select id from public.jarvis_devices`);
    expect(rows).toEqual([]);
  });

  it("hold a pending enrollment for nobody, and only while it has an expiry", async () => {
    const pending = await twin.asServiceRole<{ id: string }>(
      `insert into public.jarvis_devices (name, public_key, enrollment_expires_at)
       values ('New PC', repeat('p', 122), now() + interval '10 minutes') returning id`,
    );
    expect(pending).toHaveLength(1);
    for (const user of [A, B]) {
      const { rows } = await twin.asTenant<{ name: string }>(
        user,
        `select name from public.jarvis_devices where name = 'New PC'`,
      );
      expect(rows).toEqual([]);
    }
    const orphan = await serviceWrite(
      `insert into public.jarvis_devices (name, public_key) values ('Orphan', repeat('o', 122))`,
    );
    expect(orphan.errorCode).toBe("23514");
    const keyless = await serviceWrite(
      `insert into public.jarvis_devices (name, enrollment_expires_at) values ('No key', now())`,
    );
    expect(keyless.errorCode).toBe("23514");
    const shared = await serviceWrite(
      `insert into public.jarvis_devices (user_id, name, public_key)
       values ('${B}', 'Copy', repeat('k', 122))`,
    );
    expect(shared.errorCode).toBe("23505");
  });
});

describe("permissions", () => {
  it("cannot attach a decision to somebody else's device", async () => {
    const forged = await twin.asTenant(
      B,
      `insert into public.jarvis_permissions (user_id, device_id, capability, allowed)
       values ('${B}', '${device}', 'browser', true)`,
    );
    expect(forged.error).toBeDefined();
  });

  it("keeps one decision per scope and accepts site scopes", async () => {
    const first = await twin.asTenant(
      A,
      `insert into public.jarvis_permissions (user_id, capability, allowed)
       values ('${A}', 'site:example.com', false)`,
    );
    expect(first.error).toBeUndefined();
    const duplicate = await twin.asTenant(
      A,
      `insert into public.jarvis_permissions (user_id, capability, allowed)
       values ('${A}', 'site:example.com', true)`,
    );
    expect(duplicate.errorCode).toBe("23505");
    const junk = await twin.asTenant(
      A,
      `insert into public.jarvis_permissions (user_id, capability, allowed)
       values ('${A}', 'grant everything', true)`,
    );
    expect(junk.errorCode).toBe("23514");
  });
});

describe("activity", () => {
  it("is read-only to a browser and purges detail after 90 days", async () => {
    const direct = await twin.asTenant(
      A,
      `insert into public.jarvis_activity (user_id, task_id, summary)
       values ('${A}', '${task}', 'forged')`,
    );
    expect(direct.errorCode).toBe("42501");

    await twin.asServiceRole(
      `insert into public.jarvis_activity (user_id, task_id, summary, created_at) values
         ('${A}', '${task}', 'old', now() - interval '91 days'),
         ('${A}', '${task}', 'recent', now() - interval '89 days')`,
    );
    const [{ removed }] = await twin.asServiceRole<{ removed: number }>(
      `select public.jarvis_purge_expired_activity('${A}'::uuid) as removed`,
    );
    expect(removed).toBe(1);
    const { rows } = await twin.asTenant<{ summary: string }>(
      A,
      `select summary from public.jarvis_activity order by created_at`,
    );
    expect(rows.map((r) => r.summary)).toEqual(["recent"]);
    const [kept] = await twin.asSuperuser<{ result: string }>(
      `select result from public.jarvis_tasks where id = '${task}'`,
    );
    expect(kept!.result).toBe("Done: 3 results");
  });
});

describe("temporary frames", () => {
  it("are cleared from a task nobody has touched for an hour", async () => {
    const [{ id }] = await twin.asServiceRole<{ id: string }>(
      `insert into public.jarvis_tasks (user_id, conversation_id, title, live_frame)
       values ('${A}', '${jarvis}', 'Abandoned', 'frame') returning id`,
    );
    await twin.execSuperuser(
      `alter table public.jarvis_tasks disable trigger jarvis_tasks_frame_is_temporary;
       update public.jarvis_tasks set updated_at = now() - interval '2 hours' where id = '${id}';
       alter table public.jarvis_tasks enable trigger jarvis_tasks_frame_is_temporary;`,
    );
    await twin.asServiceRole(`select public.jarvis_purge_expired_activity('${A}'::uuid)`);
    const [row] = await twin.asSuperuser<{ live_frame: string | null; status: string }>(
      `select live_frame, status from public.jarvis_tasks where id = '${id}'`,
    );
    expect(row!.live_frame).toBeNull();
    expect(row!.status).toBe("running");
  });
});

describe("usage", () => {
  it("keeps the JARVIS and Chat allowances separate", async () => {
    expect(await permit(A, "chat-1", "chat")).toBe("granted");
    expect(await permit(A, "jarvis-1", "jarvis")).toBe("granted");
    expect(await permit(A, "jarvis-2", "jarvis")).toBe("granted");
    expect(await used(A, "chat")).toBe(100);
    expect(await used(A, "jarvis")).toBe(200);

    // JARVIS exhausted at 2 uses; Chat still has room.
    expect(await permit(A, "jarvis-3", "jarvis")).toBe("session_exhausted");
    expect(await permit(A, "chat-2", "chat")).toBe("granted");
  });

  it("releases a failed JARVIS step without touching Chat", async () => {
    await twin.asServiceRole(
      `select public.ocade_release_generation_permit('${A}'::uuid, 'jarvis-2', 'failed')`,
    );
    expect(await used(A, "jarvis")).toBe(100);
    expect(await used(A, "chat")).toBe(200);
  });

  it("settles a JARVIS step of an open task as part of that task's one use", async () => {
    // A has a task open (above): a step bound to it costs nothing now; the task is charged
    // when it completes (20261016090000, proved in jarvis-task-is-one-use.test.ts).
    const [open] = await twin.asServiceRole<{ id: string }>(
      `select id from public.jarvis_tasks where user_id = '${A}' and status = 'running' limit 1`,
    );
    const [bound] = await twin.asServiceRole<{ r: string }>(
      `select public.ocade_bind_permit_to_task('${A}'::uuid, 'jarvis-1', '${open!.id}'::uuid) as r`,
    );
    expect(bound!.r).toBe("bound");
    await twin.asServiceRole(
      `select * from public.ocade_finalize_generation_permit('${A}'::uuid, 'jarvis-1', 100)`,
    );
    expect(await used(A, "jarvis")).toBe(0);
    expect(await permit(A, "jarvis-1", "jarvis")).toBe("duplicate_completed");
  });

  it("refuses to reuse a key across surfaces", async () => {
    expect(await permit(A, "chat-1", "jarvis")).toBe("idempotency_conflict");
  });
});

describe("the rollback", () => {
  it("runs cleanly and leaves Chat intact", async () => {
    // Newest first, the way a real rollback runs: schedules depend on devices.
    const schedules = await twin.runScript(
      "supabase/rollback",
      "20260930095000_jarvis_schedules_rollback.sql",
    );
    expect(schedules.error).toBeUndefined();
    const identity = await twin.runScript(
      "supabase/rollback",
      "20260927090000_jarvis_device_identity_rollback.sql",
    );
    expect(identity.error).toBeUndefined();
    const result = await twin.runScript(
      "supabase/rollback",
      "20260926090000_ocade_jarvis_web_rollback.sql",
    );
    expect(result.error).toBeUndefined();
    const { rows } = await twin.asTenant<{ id: string }>(
      A,
      `select id from public.ocade_conversations order by created_at`,
    );
    expect(rows.map((r) => r.id)).toEqual([chat]);
  });
});
