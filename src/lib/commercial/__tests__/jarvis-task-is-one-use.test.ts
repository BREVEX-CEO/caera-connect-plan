import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";

/**
 * ONE COMPLETED JARVIS TASK IS ONE USE (owner decision, 13 October 2026; PLAN Phase 01),
 * proved on real PostgreSQL with every migration: a turn bound to its task is free, the
 * turn that starts it is free and then bound to it, completion charges exactly once
 * whatever is replayed, a failed or stopped task charges nothing, a task's 151st turn is
 * refused (never charged), and no turn is ever assigned to a task by guessing.
 */
let twin: DatabaseTwin;
const A = "aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-2222-4bbb-8bbb-bbbbbbbbbbbb";
let conversation: string;
let device: string;
let turn = 0;

const acquire = (user: string, key: string, surface = "jarvis") =>
  twin.asServiceRole<{ outcome: string }>(
    `select outcome from public.ocade_acquire_generation_permit(
       '${user}'::uuid, '${key}', '${key}', '${surface}', 'free', 1000000, null, 100)`,
  );
const bind = async (user: string, key: string, task: string) =>
  (
    await twin.asServiceRole<{ r: string }>(
      `select public.ocade_bind_permit_to_task('${user}'::uuid, '${key}', '${task}'::uuid) as r`,
    )
  )[0]!.r;
const finalize = async (user: string, key: string, cost: number) =>
  Number(
    (
      await twin.asServiceRole<{ charged_hundredths: string }>(
        `select charged_hundredths from public.ocade_finalize_generation_permit('${user}'::uuid, '${key}', ${cost})`,
      )
    )[0]!.charged_hundredths,
  );

/**
 * One model turn on the JARVIS surface: acquired, bound to `task` when the planner names
 * one, answered, settled by the server. The boundary settles a reply that calls
 * start_task at cost 0, every other at one use.
 */
async function modelTurn(
  options: { user?: string; task?: string; startsTask?: boolean } = {},
): Promise<number> {
  const user = options.user ?? A;
  const key = `turn-${user}-${++turn}`;
  await acquire(user, key);
  if (options.task) expect(await bind(user, key, options.task)).toBe("bound");
  return finalize(user, key, options.startsTask ? 0 : 100);
}

async function used(user = A): Promise<number> {
  const rows = await twin.asServiceRole<{ window_kind: string; used: string; held: string }>(
    `select window_kind, used_hundredths as used, reserved_hundredths as held
       from public.ocade_read_commercial_usage('${user}'::uuid, 'jarvis')`,
  );
  const session = rows.find((row) => row.window_kind === "session")!;
  return Number(session.used) + Number(session.held);
}

async function newTask(title: string, user = A): Promise<string> {
  const [row] = await twin.asServiceRole<{ id: string }>(
    `insert into public.jarvis_tasks (user_id, conversation_id, device_id, title)
     values ('${user}', '${conversation}', '${device}', '${title}') returning id`,
  );
  return row!.id;
}

/** As the server writes it: completed names the actions it checked (none in these tasks). */
const setStatus = (task: string, status: string) =>
  twin.asServiceRole(
    `update public.jarvis_tasks set status = '${status}',
       verified_actions = case when '${status}' = 'completed' then 0 else verified_actions end,
       finished_at = case when '${status}' in ('completed','failed','stopped','blocked')
                          then now() - interval '1 hour' else null end
     where id = '${task}'`,
  );

const boundTo = async (task: string) =>
  (
    await twin.asServiceRole<{ n: number }>(
      `select count(*)::int as n from public.ocade_generation_permits where task_id = '${task}'`,
    )
  )[0]!.n;

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(applied.filter((m) => !m.ok).map((m) => `${m.file}: ${m.error}`)).toEqual([]);
  await twin.execSuperuser(
    `insert into auth.users (id, email) values
       ('${A}', 'a@task.invalid'), ('${B}', 'b@task.invalid') on conflict do nothing;`,
  );
  [{ id: conversation }] = await twin.asServiceRole<{ id: string }>(
    `insert into public.ocade_conversations (user_id, title, surface)
     values ('${A}', 'jarvis', 'jarvis') returning id`,
  );
  [{ id: device }] = await twin.asServiceRole<{ id: string }>(
    `insert into public.jarvis_devices (user_id, name, public_key)
     values ('${A}', 'Laptop', repeat('k', 122)) returning id`,
  );
}, 240_000);

afterAll(async () => {
  await twin?.close();
});

describe("a JARVIS answer with no task", () => {
  it("is one request, one use", async () => {
    expect(await modelTurn()).toBe(100);
    expect(await used()).toBe(100);
  });
});

describe("a task", () => {
  let task: string;

  it("costs nothing for the turn that starts it, which then belongs to it, or for its own turns", async () => {
    const before = await used();
    const start = `turn-${A}-${++turn}`;
    await acquire(A, start);
    expect(await finalize(A, start, 0)).toBe(0); // the reply that calls start_task
    task = await newTask("Research and report");
    expect(await bind(A, start, task)).toBe("bound"); // reconciled into its task
    for (let i = 0; i < 5; i += 1) expect(await modelTurn({ task })).toBe(0);
    expect(await used()).toBe(before);
    expect(await boundTo(task)).toBe(6);
  });

  it("never takes a turn as the task's by guessing: a turn that names no task is a request", async () => {
    const before = await used();
    expect(await modelTurn()).toBe(100); // the task above is open, but this turn is not its
    expect(await used()).toBe(before + 100);
    expect(await boundTo(task)).toBe(6);
  });

  it("is one use when the server records it completed, exactly once whatever is replayed", async () => {
    const before = await used();
    await setStatus(task, "completed");
    expect(await used()).toBe(before + 100);
    // Replays: the same completion again, and a reopen-then-complete.
    await Promise.all([setStatus(task, "completed"), setStatus(task, "completed")]);
    await setStatus(task, "running");
    await setStatus(task, "completed");
    expect(await used()).toBe(before + 100);
    const [charges] = await twin.asServiceRole<{ n: number }>(
      `select count(*)::int as n from public.ocade_jarvis_task_charges where task_id = '${task}'`,
    );
    expect(charges!.n).toBe(1);
  });

  it("costs nothing when it fails or is stopped, however many turns it took", async () => {
    const before = await used();
    const failed = await newTask("A task that fails");
    for (let i = 0; i < 3; i += 1) await modelTurn({ task: failed });
    await setStatus(failed, "failed");
    const stopped = await newTask("A task that is stopped");
    await modelTurn({ task: stopped });
    await setStatus(stopped, "stopped");
    expect(await used()).toBe(before);
  });

  it("holds at most 150 turns: the 151st is refused before anything is sent, never charged", async () => {
    const long = await newTask("A task that runs long");
    const before = await used();
    for (let i = 0; i < 150; i += 1) expect(await modelTurn({ task: long })).toBe(0);
    const extra = `turn-${A}-${++turn}`;
    await acquire(A, extra);
    expect(await bind(A, extra, long)).toBe("task_budget_exhausted");
    const [released] = await twin.asServiceRole<{ ok: boolean }>(
      `select public.ocade_release_generation_permit('${A}'::uuid, '${extra}', 'cancelled_before_output') as ok`,
    );
    expect(released!.ok).toBe(true);
    expect(await used()).toBe(before);
    expect(await boundTo(long)).toBe(150);
    await setStatus(long, "stopped");
  }, 120_000);

  it("binds only an open task of the same account, a JARVIS permit, and never a charged one", async () => {
    const key = (n: string) => `bind-${n}-${++turn}`;
    const closed = await newTask("Closed");
    await setStatus(closed, "failed");
    const open = await newTask("Open");
    const other = key("other");
    await acquire(B, other);
    expect(await bind(B, other, open)).toBe("task_not_open"); // A's task, B's permit
    await twin.asServiceRole(
      `select public.ocade_release_generation_permit('${B}'::uuid, '${other}', 'cancelled_before_output')`,
    );
    const chat = key("chat");
    await acquire(A, chat, "chat");
    expect(await bind(A, chat, open)).toBe("refused");
    const charged = key("charged");
    await acquire(A, charged);
    expect(await finalize(A, charged, 100)).toBe(100);
    expect(await bind(A, charged, open)).toBe("refused"); // no refund by binding later
    const late = key("late");
    await acquire(A, late);
    expect(await bind(A, late, closed)).toBe("task_not_open");
    expect(await bind(A, late, open)).toBe("bound");
    expect(await bind(A, late, open)).toBe("bound"); // the same binding again changes nothing
    await setStatus(open, "stopped");
    const next = await newTask("Next");
    expect(await bind(A, late, next)).toBe("refused"); // one task's turn never moves to another
    await setStatus(next, "stopped");
  });

  it("is charged to its own account only, and nobody can write the charge record or bind", async () => {
    expect(await used(B)).toBe(0);
    const forged = await twin.asTenant(
      A,
      `insert into public.ocade_jarvis_task_charges (task_id, user_id, charged_hundredths)
       values (gen_random_uuid(), '${A}', 100)`,
    );
    expect(forged.error).toBeDefined();
    const bound = await twin.asTenant(
      A,
      `select public.ocade_bind_permit_to_task('${A}'::uuid, 'x', gen_random_uuid())`,
    );
    expect(bound.errorCode).toBe("42501");
  });
});

describe("the rollbacks", () => {
  it("undo task binding without ever charging a task's turns again", async () => {
    const result = await twin.runScript(
      "supabase/rollback",
      "20261016090000_task_bound_turns_and_checked_outcomes_rollback.sql",
    );
    expect(result.error).toBeUndefined();
    const open = await newTask("After the first rollback");
    // The code before binding: the open task's turns are inferred, and stay free past 150.
    const charges: number[] = [];
    for (let i = 0; i < 152; i += 1) charges.push(await modelTurn());
    expect(charges.every((c) => c === 0)).toBe(true);
    await twin.asServiceRole(
      `update public.jarvis_tasks set status = 'stopped' where id = '${open}'`,
    );
  }, 120_000);

  it("then 20261013090000's runs cleanly, and every turn is a request again", async () => {
    const result = await twin.runScript(
      "supabase/rollback",
      "20261013090000_one_verified_task_one_use_rollback.sql",
    );
    expect(result.error).toBeUndefined();
    await newTask("After the rollback");
    expect(await modelTurn()).toBe(100);
    expect(await modelTurn({ startsTask: true })).toBe(100);
  });
});
