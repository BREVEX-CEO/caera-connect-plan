import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../../scripts/db-twin.mts";

/**
 * ONE COMPLETED JARVIS TASK IS ONE USE (owner decision, 13 October 2026), proved on
 * real PostgreSQL with every migration: a task's turns are free, the turn that
 * starts it is free, completion charges exactly once whatever is replayed,
 * a failed or stopped task charges nothing, and one task cannot become unlimited work.
 */
let twin: DatabaseTwin;
const A = "aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-2222-4bbb-8bbb-bbbbbbbbbbbb";
let conversation: string;
let device: string;
let turn = 0;

/**
 * One model turn on the JARVIS surface: acquired, answered, settled by the server. The
 * boundary settles a reply that calls start_task at cost 0, every other at one use.
 */
async function modelTurn(user = A, startsTask = false): Promise<number> {
  const key = `turn-${user}-${++turn}`;
  await twin.asServiceRole(
    `select outcome from public.ocade_acquire_generation_permit(
       '${user}'::uuid, '${key}', '${key}', 'jarvis', 'free', 1000000, null, 100)`,
  );
  const [row] = await twin.asServiceRole<{ charged_hundredths: string }>(
    `select charged_hundredths from public.ocade_finalize_generation_permit('${user}'::uuid, '${key}', ${startsTask ? 0 : 100})`,
  );
  return Number(row!.charged_hundredths);
}

async function used(user = A): Promise<number> {
  const rows = await twin.asServiceRole<{ window_kind: string; used: string; held: string }>(
    `select window_kind, used_hundredths as used, reserved_hundredths as held
       from public.ocade_read_commercial_usage('${user}'::uuid, 'jarvis')`,
  );
  const session = rows.find((row) => row.window_kind === "session")!;
  return Number(session.used) + Number(session.held);
}

async function newTask(title: string): Promise<string> {
  const [row] = await twin.asServiceRole<{ id: string }>(
    `insert into public.jarvis_tasks (user_id, conversation_id, device_id, title)
     values ('${A}', '${conversation}', '${device}', '${title}') returning id`,
  );
  return row!.id;
}

const setStatus = (task: string, status: string) =>
  twin.asServiceRole(
    `update public.jarvis_tasks set status = '${status}',
       finished_at = case when '${status}' in ('completed','failed','stopped','blocked')
                          then now() - interval '1 hour' else null end
     where id = '${task}'`,
  );

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

  it("costs nothing for the turn that starts it or for any of its own turns", async () => {
    const before = await used();
    expect(await modelTurn(A, true)).toBe(0); // the reply that calls start_task
    task = await newTask("Research and report");
    expect(await used()).toBe(before);
    for (let i = 0; i < 5; i += 1) expect(await modelTurn()).toBe(0);
    expect(await used()).toBe(before);
    const [bound] = await twin.asServiceRole<{ n: number }>(
      `select count(*)::int as n from public.ocade_generation_permits where task_id = '${task}'`,
    );
    expect(bound!.n).toBe(5);
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
    await setStatus(task, "failed"); // the completed task above is finished an hour ago
    const before = await used();
    await modelTurn(A, true);
    const failed = await newTask("A task that fails");
    for (let i = 0; i < 3; i += 1) await modelTurn();
    await setStatus(failed, "failed");
    await modelTurn(A, true);
    const stopped = await newTask("A task that is stopped");
    await modelTurn();
    await setStatus(stopped, "stopped");
    expect(await used()).toBe(before);
  });

  it("holds at most 150 turns: past that a turn is charged, so one request is not unlimited work", async () => {
    const long = await newTask("A task that runs long");
    const before = await used();
    const charges: number[] = [];
    for (let i = 0; i < 151; i += 1) charges.push(await modelTurn());
    expect(charges.slice(0, 150).every((c) => c === 0)).toBe(true);
    expect(charges[150]).toBe(100);
    expect(await used()).toBe(before + 100);
    await setStatus(long, "stopped");
  }, 120_000);

  it("is charged to its own account only, and nobody can write the charge record", async () => {
    expect(await used(B)).toBe(0);
    const forged = await twin.asTenant(
      A,
      `insert into public.ocade_jarvis_task_charges (task_id, user_id, charged_hundredths)
       values (gen_random_uuid(), '${A}', 100)`,
    );
    expect(forged.error).toBeDefined();
  });
});

describe("the rollback", () => {
  it("runs cleanly, and every turn is a request again", async () => {
    const result = await twin.runScript(
      "supabase/rollback",
      "20261013090000_one_verified_task_one_use_rollback.sql",
    );
    expect(result.error).toBeUndefined();
    await newTask("After the rollback");
    expect(await modelTurn()).toBe(100);
    expect(await modelTurn(A, true)).toBe(100);
  });
});
