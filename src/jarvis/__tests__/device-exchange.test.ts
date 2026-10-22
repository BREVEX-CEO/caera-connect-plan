import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../scripts/db-twin.mts";
import { enrollmentRoom, exchange, exchangeInput, MAX_PENDING_PER_SOURCE } from "../device.server";
import { NOT_VERIFIED } from "../protocol";
import { changeTask, completionGap, queueTaskAction } from "../task-authority.server";
import { lit, restOver } from "./rest-adapter";

/**
 * The device exchange against real PostgreSQL with the real migrations
 * (Error Audit 01: JARVIS-023 active STOP, JARVIS-054 permission at dispatch).
 * A tiny PostgREST-shaped adapter runs the exact queries `exchange` builds.
 */
let twin: DatabaseTwin;
const A = "aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa";
let device: string;
let conversation: string;

const rest = () => restOver(twin);

const run = (input: Parameters<typeof exchange>[2]) =>
  exchange(rest() as never, { id: device, userId: A }, input);

async function task(): Promise<string> {
  const [row] = await twin.asServiceRole<{ id: string }>(
    `insert into public.jarvis_tasks (user_id, conversation_id, device_id, title)
     values ('${A}', '${conversation}', '${device}', 't') returning id`,
  );
  return row!.id;
}

async function queue(taskId: string, action: object, confirmed = false): Promise<string> {
  const [row] = await twin.asServiceRole<{ id: string }>(
    // Queued by the loop that controls the task, as queueTaskAction does (20261016100000).
    `insert into public.jarvis_activity (user_id, task_id, device_id, summary, action, status, confirmed, controller)
     values ('${A}', '${taskId}', '${device}', 's', ${lit(action)}, 'queued', ${confirmed},
             (select controller from public.jarvis_tasks where id = '${taskId}'))
     returning id`,
  );
  return row!.id;
}

const status = async (id: string) =>
  (
    await twin.asServiceRole<{ status: string; result: Record<string, unknown> | null }>(
      `select status, result from public.jarvis_activity where id = '${id}'`,
    )
  )[0]!;

const permit = (capability: string, allowed: boolean) =>
  twin.asServiceRole(
    `insert into public.jarvis_permissions (user_id, capability, allowed)
     values ('${A}', '${capability}', ${allowed})`,
  );

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(applied.filter((m) => !m.ok)).toEqual([]);
  await twin.execSuperuser(
    `insert into auth.users (id, email) values ('${A}', 'a@jarvis.invalid') on conflict do nothing;`,
  );
  [{ id: conversation }] = await twin.asServiceRole<{ id: string }>(
    `insert into public.ocade_conversations (user_id, title, surface)
     values ('${A}', 'j', 'jarvis') returning id`,
  );
  [{ id: device }] = await twin.asServiceRole<{ id: string }>(
    `insert into public.jarvis_devices (user_id, name, public_key, capabilities)
     values ('${A}', 'Laptop', repeat('k', 122), '{"files": true, "apps": true}') returning id`,
  );
}, 240_000);

afterAll(async () => {
  await twin?.close();
});

beforeEach(async () => {
  for (const table of ["jarvis_activity", "jarvis_tasks", "jarvis_permissions"]) {
    await twin.asServiceRole(`delete from public.${table}`);
  }
});

describe("dispatch", () => {
  it("keeps the task's opt-in quality when an older client overwrites its checkpoint", async () => {
    const t = await task();
    await twin.asServiceRole(
      `update public.jarvis_tasks set checkpoint = '{"step":0,"lastAction":"Started","lastUrl":null,"at":"","intelligenceQuality":"high"}' where id = '${t}'`,
    );
    const row = await changeTask(rest() as never, rest() as never, A, {
      id: t,
      checkpoint: {
        step: 1,
        lastAction: "read",
        lastUrl: null,
        at: "",
        intelligenceQuality: "standard",
      },
    });
    expect(row?.checkpoint).toMatchObject({ intelligenceQuality: "high", step: 1 });
  });

  it("hands out one action at a time and nothing while one runs", async () => {
    const t = await task();
    await permit("files", true);
    const first = await queue(t, { action: "file_list", path: "." });
    const second = await queue(t, { action: "file_list", path: "src" });
    const out = await run({ results: [] });
    expect(out.commands.map((c) => c.id)).toEqual([first]);
    const busy = await run({ results: [], running: [first] });
    expect(busy.commands).toEqual([]);
    expect(busy.cancel).toEqual([]);
    expect((await status(second)).status).toBe("queued");
  });

  it("re-checks permission when the action leaves, not only when it was queued", async () => {
    const t = await task();
    await permit("files", true);
    const id = await queue(t, { action: "file_list", path: "." });
    await twin.asServiceRole(
      `update public.jarvis_permissions set allowed = false where capability = 'files'`,
    );
    const out = await run({ results: [] });
    expect(out.commands).toEqual([]);
    const row = await status(id);
    expect(row.status).toBe("cancelled");
    expect(row.result?.status).toBe("refused");
  });

  it("cancels the running steps a withdrawn permission no longer covers (C04)", async () => {
    const t = await task();
    await permit("files", true);
    await twin.asServiceRole(
      `update public.jarvis_devices set capabilities = '{"files": true, "segment_v1": true}' where id = '${device}'`,
    );
    try {
      const first = await queue(t, { action: "file_list", path: "." });
      const second = await queue(t, { action: "file_write", path: "a.txt", content: "x" });
      const out = await run({ results: [] });
      expect(out.commands.map((c) => c.id)).toEqual([first, second]);
      // Still allowed: both keep running.
      expect((await run({ results: [], running: [first, second] })).cancel).toEqual([]);
      await twin.asServiceRole(
        `update public.jarvis_permissions set allowed = false where capability = 'files'`,
      );
      expect((await run({ results: [], running: [first, second] })).cancel).toEqual([
        first,
        second,
      ]);
    } finally {
      await twin.asServiceRole(
        `update public.jarvis_devices set capabilities = '{"files": true, "apps": true}' where id = '${device}'`,
      );
    }
  });

  it("asks before running code the task changed where nothing confines a command (C19)", async () => {
    const t = await task();
    await permit("files", true);
    await permit("terminal", true);
    await twin.asServiceRole(
      `update public.jarvis_tasks set controller = '${A}' where id = '${t}'`,
    );
    const tests = () =>
      queueTaskAction(rest() as never, rest() as never, A, {
        taskId: t,
        controller: A,
        action: { action: "run", command: "python -m unittest" } as never,
      });
    const offer = (sandbox: boolean) =>
      twin.asServiceRole(
        `update public.jarvis_devices set capabilities = '{"files": true, "terminal": true, "terminal_sandbox": ${sandbox}}' where id = '${device}'`,
      );
    try {
      await offer(false);
      // The person's own tests, before the task changed anything: run unasked.
      expect(await tests()).toMatchObject({ ok: true, needsConfirmation: false });
      await queue(t, { action: "file_write", path: "invoice.py", content: "x" });
      expect(await tests()).toMatchObject({ ok: true, needsConfirmation: true });
      // Where a real sandbox confines it, the same re-run is not a question.
      await offer(true);
      expect(await tests()).toMatchObject({ ok: true, needsConfirmation: false });
    } finally {
      await twin.asServiceRole(
        `update public.jarvis_devices set capabilities = '{"files": true, "apps": true}' where id = '${device}'`,
      );
    }
  });

  it("tells the computer which apps are set to Never, so no route reaches them (E04)", async () => {
    const t = await task();
    await permit("files", true);
    await permit("app:editor", false);
    await permit("app:browser", true);
    await twin.asServiceRole(
      `insert into public.jarvis_permissions (user_id, capability, allowed, device_id)
       values ('${A}', 'app:notes', false, '${device}'), ('${A}', 'app:mail', false, null),
              ('${A}', 'app:mail', true, '${device}')`,
    );
    await queue(t, { action: "file_list", path: "." });
    const [command] = (await run({ results: [] })).commands;
    // Account-wide or for this computer; this computer's own Always wins over an account Never.
    expect([...command!.never].sort()).toEqual(["editor", "notes"]);
  });

  it("refuses when the master switch was turned off", async () => {
    const t = await task();
    await permit("files", true);
    await permit("master", false);
    const id = await queue(t, { action: "file_list", path: "." });
    expect((await run({ results: [] })).commands).toEqual([]);
    expect((await status(id)).status).toBe("cancelled");
  });

  it("refuses an action that needs a confirmation it never received", async () => {
    const t = await task();
    await permit("files", true);
    const id = await queue(t, { action: "file_delete", path: "notes.md" });
    expect((await run({ results: [] })).commands).toEqual([]);
    expect((await status(id)).status).toBe("cancelled");
    const confirmed = await queue(t, { action: "file_delete", path: "notes.md" }, true);
    expect((await run({ results: [] })).commands.map((c) => c.id)).toEqual([confirmed]);
  });

  it("sends the sites the person allowed", async () => {
    const t = await task();
    await permit("site:router.lan", true);
    await permit("site:blocked.example", false);
    await queue(t, { action: "open", url: "https://example.com" });
    const [command] = (await run({ results: [] })).commands;
    expect(command!.sites).toEqual(["router.lan"]);
  });
});

describe("results", () => {
  it("records an action that went stale as not done, keeping the device's own word", async () => {
    // Seen in Activity: a refused stale click read "done".
    const t = await task();
    await permit("files", true);
    const id = await queue(t, { action: "file_list", path: "." });
    await run({ results: [] });
    await run({
      results: [{ id, status: "stale", summary: "That screen observation is too old." }],
    });
    const row = await status(id);
    expect(row.status).toBe("failed");
    expect((row.result as { status: string }).status).toBe("stale");
  });

  it("answers each result with the receipt the device gave it, and a resent one is not counted twice (V04)", async () => {
    const t = await task();
    await permit("files", true);
    const id = await queue(t, { action: "file_write", path: "a.txt", content: "x" });
    await run({ results: [] });
    const first = await run({
      results: [{ id, status: "done", summary: "Wrote", receipt: "r-1" }],
    });
    expect(first.acks).toEqual([{ id, receipt: "r-1", outcome: "accepted" }]);
    // The reply was lost: the device sends the same result again, under its own receipt.
    const again = await run({
      results: [{ id, status: "done", summary: "Wrote", receipt: "r-1" }],
    });
    expect(again.acks).toEqual([{ id, receipt: "r-1", outcome: "unknown" }]);
    expect((await status(id)).status).toBe("done");
    // A malformed receipt never rejects the exchange: the result is read with no receipt to match.
    const parsed = exchangeInput.parse({ results: [{ id, status: "done", receipt: 42 }] });
    expect(parsed.results[0]!.receipt).toBeUndefined();
  });
});

describe("STOP", () => {
  const LOOP = "11111111-2222-4333-8444-555555555555";
  const OTHER_LOOP = "99999999-8888-4777-8666-555555555555";
  /** queueTaskAction as a loop sees it when STOP or a takeover lands between its read and insert. */
  const queueAfterARace = async (t: string, action: object) => {
    const real = rest();
    const snapshot = {
      id: t,
      status: "running",
      device_id: device,
      browser_mode: "isolated",
      controller: LOOP,
    };
    const read = {
      select: () => read,
      eq: () => read,
      maybeSingle: () => Promise.resolve({ data: snapshot, error: null }),
    };
    const stale = { from: (table: string) => (table === "jarvis_tasks" ? read : real.from(table)) };
    return queueTaskAction(stale as never, real as never, A, {
      taskId: t,
      controller: LOOP,
      action: action as never,
    });
  };

  it("queues nothing that lands after STOP or a takeover, and says which (Phase 02, V03)", async () => {
    const t = await task();
    await permit("files", true);
    await twin.asServiceRole(
      `update public.jarvis_tasks set controller = '${LOOP}' where id = '${t}'`,
    );
    const fine = await queueAfterARace(t, { action: "file_list", path: "." });
    expect(fine).toMatchObject({ ok: true });
    // Another tab took it over after this loop read the task.
    await twin.asServiceRole(
      `update public.jarvis_tasks set controller = '${OTHER_LOOP}' where id = '${t}'`,
    );
    expect(await queueAfterARace(t, { action: "file_list", path: "." })).toEqual({
      ok: false,
      lost: true,
      message: "Another device took control of this task.",
    });
    // STOP after this loop read the task.
    await twin.asServiceRole(
      `update public.jarvis_tasks set controller = '${LOOP}', status = 'stopped' where id = '${t}'`,
    );
    expect(await queueAfterARace(t, { action: "file_write", path: "a.txt", content: "x" })).toEqual(
      {
        ok: false,
        message: "The task is not running.",
      },
    );
    const [{ n }] = await twin.asServiceRole<{ n: number }>(
      `select count(*)::int as n from public.jarvis_activity where task_id = '${t}' and status = 'queued'`,
    );
    expect(n).toBe(1); // only the step queued while it was running
  });

  it("clears a step left queued on a task that no longer runs, so it cannot hold the queue", async () => {
    const t = await task();
    await permit("files", true);
    const stuck = await queue(t, { action: "file_list", path: "." });
    // As an older server could leave it: queued, but its task already stopped.
    await twin.asServiceRole(`update public.jarvis_tasks set status = 'stopped' where id = '${t}'`);
    expect((await run({ results: [] })).commands).toEqual([]);
    expect((await status(stuck)).status).toBe("cancelled");
    const next = await task();
    const id = await queue(next, { action: "file_list", path: "." });
    expect((await run({ results: [] })).commands.map((c) => c.id)).toEqual([id]);
  });

  it("cancels the running action and never counts its late result as done", async () => {
    const t = await task();
    await permit("files", true);
    const id = await queue(t, { action: "file_list", path: "." });
    await run({ results: [] });
    // The web STOP: the task stops and the claimed action is cancelled.
    await twin.asServiceRole(`update public.jarvis_tasks set status = 'stopped' where id = '${t}'`);
    await twin.asServiceRole(
      `update public.jarvis_activity set status = 'cancelled' where id = '${id}'`,
    );
    const reply = await run({ results: [], running: [id] });
    expect(reply.cancel).toEqual([id]);
    await run({ results: [{ id, status: "done", summary: "finished anyway" }] });
    const row = await status(id);
    expect(row.status).toBe("cancelled");
    expect(row.result).toMatchObject({ status: "stopped", late: "done", changed: [] });
  });

  it("keeps a stopped step that had reached the computer as unknown, and its late effect in full", async () => {
    const t = await task();
    await permit("files", true);
    const id = await queue(t, { action: "file_write", path: "a.txt", content: "x" });
    await run({ results: [] });
    await twin.asServiceRole(
      `update public.jarvis_activity set status = 'cancelled' where id = '${id}'`,
    );
    expect((await status(id)).result).toEqual({ status: "unknown" });
    expect(await completionGap(rest() as never, A, t)).toMatch(/read the result back/);
    const reply = await run({
      results: [{ id, status: "done", summary: "Wrote a.txt", changed: ["a.txt"] }],
    });
    expect(reply.acks).toEqual([{ id, outcome: "stopped" }]);
    expect((await status(id)).result).toMatchObject({
      status: "stopped",
      late: "done",
      changed: ["a.txt"],
    });
  });

  it("cancels the running action when the task is taken over", async () => {
    const t = await task();
    await permit("files", true);
    const id = await queue(t, { action: "file_list", path: "." });
    await run({ results: [] });
    await twin.asServiceRole(
      `update public.jarvis_tasks set status = 'taken_over' where id = '${t}'`,
    );
    expect((await run({ results: [], running: [id] })).cancel).toEqual([id]);
  });

  it("from the computer cancels queued, waiting and running work", async () => {
    const t = await task();
    await permit("files", true);
    const running = await queue(t, { action: "file_list", path: "." });
    await run({ results: [] });
    const waiting = await queue(t, { action: "file_list", path: "src" });
    const reply = await run({ results: [], running: [running], stop: true });
    expect(reply.cancel).toEqual([running]);
    expect((await status(running)).status).toBe("cancelled");
    expect((await status(waiting)).status).toBe("cancelled");
  });
});

describe("Pause and Resume from the computer's tray", () => {
  const taskStatus = async (id: string) =>
    (
      await twin.asServiceRole<{ status: string; blocker: string | null }>(
        `select status, blocker from public.jarvis_tasks where id = '${id}'`,
      )
    )[0]!;

  it("pause hands the task to the person and cancels the step in progress", async () => {
    const t = await task();
    await permit("files", true);
    const running = await queue(t, { action: "file_list", path: "." });
    await run({ results: [] });
    const reply = await run({ results: [], running: [running], pause: true });
    expect(await taskStatus(t)).toEqual({
      status: "taken_over",
      blocker: "Paused on the computer.",
    });
    expect(reply.cancel).toEqual([running]);
    expect(reply.task?.status).toBe("taken_over");
  });

  it("resume gives it back, and never revives a task that ended", async () => {
    const t = await task();
    await run({ results: [], pause: true });
    await run({ results: [], resume: true });
    expect(await taskStatus(t)).toEqual({ status: "running", blocker: null });
    await twin.asServiceRole(`update public.jarvis_tasks set status = 'stopped' where id = '${t}'`);
    await run({ results: [], resume: true });
    expect((await taskStatus(t)).status).toBe("stopped");
  });

  it("never lets the computer believe a pause that was not saved", async () => {
    const broken = {
      from: (name: string) =>
        name === "jarvis_tasks"
          ? {
              ...rest().from(name),
              update: () => {
                const q = {
                  eq: () => q,
                  in: () => q,
                  then: (resolve: (r: unknown) => void) =>
                    resolve({ data: null, error: { message: "tasks unavailable" } }),
                };
                return q;
              },
            }
          : rest().from(name),
    };
    await task();
    await expect(
      exchange(broken as never, { id: device, userId: A }, { results: [], pause: true }),
    ).rejects.toThrow(/unavailable/);
  });
});

describe("a task nobody drives any more", () => {
  const taskRow = async (id: string) =>
    (
      await twin.asServiceRole<{ status: string; blocker: string | null }>(
        `select status, blocker from public.jarvis_tasks where id = '${id}'`,
      )
    )[0]!;
  const age = (id: string, minutes: number) =>
    twin.execSuperuser(
      `alter table public.jarvis_tasks disable trigger user;
       update public.jarvis_tasks set updated_at = now() - interval '${minutes} minutes' where id = '${id}';
       alter table public.jarvis_tasks enable trigger user;`,
    );

  it("waits at its checkpoint when its planning loop has gone quiet", async () => {
    const t = await task();
    await age(t, 5);
    const reply = await run({ results: [] });
    const row = await taskRow(t);
    expect(row.status).toBe("waiting");
    expect(row.blocker).toMatch(/Resume to continue/);
    expect(reply.task?.status).toBe("waiting");
  });

  it("keeps running while work is queued, running or awaiting the person", async () => {
    await permit("files", true);
    const t = await task();
    await queue(t, { action: "file_list", path: "." });
    await age(t, 5);
    await run({ results: [], running: [] });
    expect((await taskRow(t)).status).toBe("running");
  });

  it("withdraws a confirmation nobody is left to answer", async () => {
    await permit("files", true);
    const t = await task();
    const asked = await queue(t, { action: "file_delete", path: "old.txt" });
    await twin.asServiceRole(
      `update public.jarvis_activity set status = 'needs_confirmation' where id = '${asked}'`,
    );
    await age(t, 5);
    await run({ results: [] });
    expect((await taskRow(t)).status).toBe("waiting");
    expect((await status(asked)).status).toBe("cancelled");
  });

  it("leaves a recently touched task alone", async () => {
    const t = await task();
    await age(t, 1);
    await run({ results: [] });
    expect((await taskRow(t)).status).toBe("running");
  });
});

describe("Activity privacy (JARVIS-021)", () => {
  it("never stores a local path or the user name inside it", async () => {
    const { redactLocal } = await import("../device.server");
    expect(
      redactLocal(
        "Failed: [Errno 2] No such file: 'C:\\Users\\haans\\Documents\\secret.txt' and /home/ana/x and \\\\server\\share\\y",
      ),
    ).toBe("Failed: [Errno 2] No such file: '[path]' and [path] and [path]");
    expect(redactLocal("Wrote notes/today.md")).toBe("Wrote notes/today.md");
  });
});

describe("Disconnect from the computer (forget)", () => {
  const failing = (table: string) => {
    const real = rest();
    return {
      from: (name: string) =>
        name === table
          ? {
              update: () => {
                const broken = {
                  eq: () => broken,
                  in: () => broken,
                  select: () => broken,
                  then: (resolve: (r: unknown) => void) =>
                    resolve({ data: null, error: { message: `${table} is unavailable` } }),
                };
                return broken;
              },
            }
          : real.from(name),
    };
  };
  const keyOf = async (id: string) =>
    (
      await twin.asServiceRole<{ revoked: boolean; key: string | null }>(
        `select revoked_at is not null as revoked, public_key as key from public.jarvis_devices where id = '${id}'`,
      )
    )[0]!;
  const freshDevice = async () =>
    (
      await twin.asServiceRole<{ id: string }>(
        `insert into public.jarvis_devices (user_id, name, public_key, capabilities)
         values ('${A}', 'Spare', repeat(md5(random()::text), 4), '{"files": true}') returning id`,
      )
    )[0]!.id;

  it("ends its work and revokes its key", async () => {
    const id = await freshDevice();
    const [{ id: t }] = await twin.asServiceRole<{ id: string }>(
      `insert into public.jarvis_tasks (user_id, conversation_id, device_id, title)
       values ('${A}', '${conversation}', '${id}', 't') returning id`,
    );
    await exchange(rest() as never, { id, userId: A }, { results: [], forget: true });
    expect(await keyOf(id)).toEqual({ revoked: true, key: null });
    const [row] = await twin.asServiceRole<{ status: string }>(
      `select status from public.jarvis_tasks where id = '${t}'`,
    );
    expect(row!.status).toBe("stopped");
  });

  for (const table of ["jarvis_activity", "jarvis_tasks", "jarvis_devices"]) {
    it(`never reports success when ${table} could not be written`, async () => {
      const id = await freshDevice();
      await expect(
        exchange(failing(table) as never, { id, userId: A }, { results: [], forget: true }),
      ).rejects.toThrow(/unavailable/);
      if (table !== "jarvis_devices") expect((await keyOf(id)).revoked).toBe(false);
    });
  }

  it("never reports success when no device row was revoked", async () => {
    const missing = "0276ec3b-3462-468d-864b-bd218fd7d28f";
    await expect(
      exchange(rest() as never, { id: missing, userId: A }, { results: [], forget: true }),
    ).rejects.toThrow(/not disconnected/);
  });
});

describe("segments (P08)", () => {
  const offer = (segments: boolean) =>
    twin.asServiceRole(
      `update public.jarvis_devices set capabilities = '{"files": true, "apps": true, "segment_v1": ${segments}}'
       where id = '${device}'`,
    );
  afterAll(() => offer(false));

  it("hands a device that runs segments the task's queued steps in one exchange", async () => {
    await offer(true);
    const t = await task();
    await permit("files", true);
    const ids = [
      await queue(t, { action: "file_list", path: "." }),
      await queue(t, { action: "file_list", path: "a" }),
      await queue(t, { action: "file_list", path: "b" }),
    ];
    const out = await run({ results: [] });
    expect(out.commands.map((c) => c.id)).toEqual(ids);
    for (const id of ids) expect((await status(id)).status).toBe("claimed");
  });

  it("hands at most twelve steps at once: the thirteenth waits for the next exchange (Phase 05)", async () => {
    await offer(true);
    const t = await task();
    await permit("files", true);
    const ids: string[] = [];
    for (let i = 0; i < 13; i += 1)
      ids.push(await queue(t, { action: "file_list", path: `d${i}` }));
    expect((await run({ results: [] })).commands.map((c) => c.id)).toEqual(ids.slice(0, 12));
    expect((await status(ids[12]!)).status).toBe("queued");
  });

  it("ends the segment before a step that still needs the person", async () => {
    await offer(true);
    const t = await task();
    await permit("files", true);
    const first = await queue(t, { action: "file_list", path: "." });
    const ask = await queue(t, { action: "file_delete", path: "old.txt" });
    await queue(t, { action: "file_list", path: "b" });
    expect((await run({ results: [] })).commands.map((c) => c.id)).toEqual([first]);
    expect((await status(ask)).status).toBe("queued");
  });

  it("gives a device without segments one step at a time", async () => {
    await offer(false);
    const t = await task();
    await permit("files", true);
    const first = await queue(t, { action: "file_list", path: "." });
    await queue(t, { action: "file_list", path: "a" });
    expect((await run({ results: [] })).commands.map((c) => c.id)).toEqual([first]);
  });

  it("cancels every step of a running segment when the task stops, and records skipped as not done", async () => {
    await offer(true);
    const t = await task();
    await permit("files", true);
    const ids = [
      await queue(t, { action: "file_list", path: "." }),
      await queue(t, { action: "file_list", path: "a" }),
    ];
    await run({ results: [] });
    expect((await run({ results: [], running: ids })).cancel).toEqual([]);
    await run({
      results: [
        { id: ids[0]!, status: "failed", summary: "No such folder" },
        { id: ids[1]!, status: "skipped", summary: "Not run" },
      ],
    });
    expect((await status(ids[1]!)).status).toBe("cancelled");
    const third = await queue(t, { action: "file_list", path: "c" });
    await twin.asServiceRole(`update public.jarvis_tasks set status = 'stopped' where id = '${t}'`);
    expect((await run({ results: [], running: [third] })).cancel).toEqual([third]);
  });
});

describe("key rotation (P03)", () => {
  it("never claims work in the rotation exchange, whose answer the device does not run", async () => {
    const t = await task();
    await permit("files", true);
    const id = await queue(t, { action: "file_list", path: "." });
    const [{ key }] = await twin.asServiceRole<{ key: string }>(
      `select public_key as key from public.jarvis_devices where id = '${device}'`,
    );
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
    ]);
    const fresh = Buffer.from(await crypto.subtle.exportKey("spki", pair.publicKey)).toString(
      "base64url",
    );
    const reply = await run({ results: [], rotate: { publicKey: fresh } });
    expect(reply.rotated).toBe(true);
    expect(reply.commands).toEqual([]);
    expect((await status(id)).status).toBe("queued");
    expect((await run({ results: [] })).commands.map((c) => c.id)).toEqual([id]);
    await twin.asServiceRole(
      `update public.jarvis_devices set public_key = '${key}' where id = '${device}'`,
    );
  });
});

describe("completion needs evidence from the device (P01)", () => {
  const settle = async (id: string, status: string, result: object | null = null) =>
    twin.asServiceRole(
      `update public.jarvis_activity set status = '${status}', result = ${result ? lit(result) : "null"}
       where id = '${id}'`,
    );
  const gap = (t: string) => completionGap(rest() as never, A, t);

  it("refuses a model that says completed when nothing was done or checked", async () => {
    const t = await task();
    expect(await gap(t)).toMatch(/read the result back/);
    await expect(
      changeTask(rest() as never, rest() as never, A, { id: t, status: "completed" }),
    ).rejects.toThrow(NOT_VERIFIED);
    const [row] = await twin.asServiceRole<{ status: string }>(
      `select status from public.jarvis_tasks where id = '${t}'`,
    );
    expect(row!.status).toBe("running");
  });

  it("refuses while an action's outcome is still unknown", async () => {
    const t = await task();
    await queue(t, { action: "file_write", path: "a.txt", content: "x" });
    expect(await gap(t)).toMatch(/has not finished/);
  });

  it("refuses a change that nothing read back afterwards, even if a read came before it", async () => {
    const t = await task();
    await settle(await queue(t, { action: "file_info", path: "a.txt" }), "done");
    await settle(await queue(t, { action: "file_write", path: "a.txt", content: "x" }), "done");
    expect(await gap(t)).toMatch(/read the result back/);
  });

  it("refuses when the read after the change failed", async () => {
    const t = await task();
    await settle(await queue(t, { action: "file_write", path: "a.txt", content: "x" }), "done");
    await settle(await queue(t, { action: "file_info", path: "a.txt" }), "failed");
    expect(await gap(t)).toMatch(/read the result back/);
  });

  it("keeps a recipe only for work that was checked (P10)", async () => {
    const t = await task();
    await permit("apps", true);
    await twin.asServiceRole(
      `update public.jarvis_tasks set controller = '${A}' where id = '${t}'`,
    );
    const recipe = {
      action: "recipe_save",
      app: "Paint",
      route: "ribbon",
      steps: [],
      verify: "read back",
    };
    const save = () =>
      queueTaskAction(rest() as never, rest() as never, A, {
        taskId: t,
        controller: A,
        action: recipe as never,
      });
    await settle(await queue(t, { action: "file_write", path: "a.txt", content: "x" }), "done");
    const refused = await save();
    expect(refused).toMatchObject({ ok: false });
    expect((refused as { message: string }).message).toMatch(/only after the result is checked/);
    await settle(await queue(t, { action: "file_read", path: "a.txt" }), "done");
    expect(await save()).toMatchObject({ ok: true });
  });

  it("refuses a second copy of an output written under another name (HX-02)", async () => {
    const t = await task();
    await permit("files", true);
    await permit("apps", true);
    await twin.asServiceRole(
      `update public.jarvis_tasks set controller = '${A}' where id = '${t}'`,
    );
    const write = (path: string, content = "OCADE JARVIS TEST OK") =>
      queueTaskAction(rest() as never, rest() as never, A, {
        taskId: t,
        controller: A,
        action: { action: "file_write", path, content } as never,
      });
    const first = await write("jarvis-smoke-20261020-01.txt");
    await settle((first as { id: string }).id, "done");
    const again = await write("jarvissmoke-20261020-01.txt");
    expect(again).toMatchObject({ ok: false });
    expect((again as { message: string }).message).toMatch(/already wrote exactly this content/);
    // Rewriting the same file, or other content, is not a copy.
    expect(await write("jarvis-smoke-20261020-01.txt")).toMatchObject({ ok: true });
    expect(await write("notes.txt", "other")).toMatchObject({ ok: true });
  });

  it("opens an app named by fewer or more words than its listing, when only one fits (HX-08)", async () => {
    const t = await task();
    await permit("apps", true);
    await twin.asServiceRole(
      `update public.jarvis_tasks set controller = '${A}' where id = '${t}'`,
    );
    await twin.asServiceRole(
      `update public.jarvis_devices set installed_apps = '["Word", "WordPad", "Excel"]'::jsonb where id = '${device}'`,
    );
    const open = (name: string) =>
      queueTaskAction(rest() as never, rest() as never, A, {
        taskId: t,
        controller: A,
        action: { action: "open_app", name } as never,
      });
    expect(await open("Microsoft Word")).toMatchObject({ ok: true });
    const queued = await twin.asServiceRole<{ action: { name: string } }>(
      `select action from public.jarvis_activity where task_id = '${t}' order by created_at desc limit 1`,
    );
    expect(queued[0]!.action.name).toBe("Word");
    expect(await open("Paint")).toMatchObject({ ok: false });
  });

  it("refuses when a different file was read than the one changed", async () => {
    const t = await task();
    await settle(await queue(t, { action: "file_write", path: "a.txt", content: "x" }), "done");
    await settle(await queue(t, { action: "file_read", path: "b.txt" }), "done");
    expect(await gap(t)).toMatch(/a\.txt was changed but its content was never read back/);
  });

  it.each([
    ["Report.txt", "report.txt"],
    [" report.txt", "report.txt"],
    ["folder\\report.txt", "folder/report.txt"],
  ])("does not equate distinct submitted file names %s and %s", async (changed, other) => {
    const t = await task();
    await settle(await queue(t, { action: "file_write", path: changed, content: "x" }), "done");
    await settle(await queue(t, { action: "file_read", path: other }), "done");
    expect(await gap(t)).toContain("content was never read back");
    // A fresh read of the original path still provides structural proof.
    await settle(await queue(t, { action: "file_read", path: changed }), "done");
    expect(await gap(t)).toBeNull();
  });

  it("refuses a content change checked only by the file's size and date", async () => {
    const t = await task();
    await settle(await queue(t, { action: "file_write", path: "a.txt", content: "x" }), "done");
    await settle(await queue(t, { action: "file_info", path: "a.txt" }), "done");
    expect(await gap(t)).toMatch(/content was never read back/);
  });

  describe("the task's fixed checks decide completed, not the model's quotes (Phase 01)", () => {
    const withChecks = async (checks: object[]) => {
      const [row] = await twin.asServiceRole<{ id: string }>(
        `insert into public.jarvis_tasks (user_id, conversation_id, device_id, title, outcome)
         values ('${A}', '${conversation}', '${device}', 't', ${lit(checks)}) returning id`,
      );
      return row!.id;
    };
    const done = (id: string, result: object = { status: "done" }) => settle(id, "done", result);
    const sheet = (cells: Record<string, unknown>, name = "Sheet1") => ({
      status: "done",
      changed: [],
      observation: null,
      // As the exchange stores a device result: everything beyond its status is `detail`.
      detail: {
        workbook: {
          sheet: name,
          sheets: [
            { name: "Sheet1", rows: 12, filledRows: 12 },
            { name: "Summary", rows: 3, filledRows: 3 },
          ],
          cells: [Object.entries(cells).map(([cell, value]) => ({ cell, value }))],
        },
      },
    });
    const complete = (t: string) =>
      changeTask(rest() as never, rest() as never, A, { id: t, status: "completed" });
    const statusOf = async (t: string) =>
      (
        await twin.asServiceRole<{ status: string; verified_actions: number | null }>(
          `select status, verified_actions from public.jarvis_tasks where id = '${t}'`,
        )
      )[0]!;

    it("judges a pause by the player's own record, never by clicks (live Gemini, 17 Oct)", async () => {
      const t = await withChecks([{ pausedAt: 30 }]);
      const player = (paused: boolean, currentTime: number) => ({
        status: "done",
        changed: [],
        observation: null,
        detail: { media: { paused, currentTime, duration: 120 } },
      });
      // Clicked the player and looked: no media state read, so nothing proves where it stopped.
      await done(await queue(t, { action: "click", ref: "e1", observationId: "o1" }));
      await done(await queue(t, { action: "observe" }));
      await expect(complete(t)).rejects.toThrow(/not read with media state/);
      await done(await queue(t, { action: "media", op: "state" }), player(false, 31));
      await expect(complete(t)).rejects.toThrow(/playing at 31 s, not paused at 30 s/);
      await done(await queue(t, { action: "media", op: "pause" }), player(true, 30.2));
      // The pause's own answer is a change, not a read of the page after it.
      await expect(complete(t)).rejects.toThrow(/read the result back|not read with media state/);
      await done(await queue(t, { action: "media", op: "state" }), player(true, 30.2));
      await complete(t);
      expect((await statusOf(t)).status).toBe("completed");
    });

    it("refuses a workbook whose asked-for sheet is empty (live Gemini reconcile, 17 Oct)", async () => {
      const t = await withChecks([{ path: "r.xlsx", sheet: "Matched" }]);
      const book = (rows: number) => ({
        status: "done",
        changed: [],
        observation: null,
        detail: {
          workbook: {
            sheet: "Sheet1",
            sheets: [{ name: "Matched", rows, filledRows: rows }],
            cells: [],
          },
        },
      });
      await done(await queue(t, { action: "sheet_edit", path: "r.xlsx", ops: [] }));
      await done(await queue(t, { action: "file_extract", path: "r.xlsx" }), {
        status: "done",
        content: "Sheet Matched:",
      });
      // The file is there and names its sheet; only the workbook's own read says what it holds.
      await expect(complete(t)).rejects.toThrow(/not read with sheet_inspect/);
      await done(await queue(t, { action: "sheet_inspect", path: "r.xlsx" }), book(1));
      await expect(complete(t)).rejects.toThrow(
        /Matched sheet of r\.xlsx has no rows below its header/,
      );
      // Not named by any check, still empty: a sheet nobody filled is no finished result.
      await done(await queue(t, { action: "sheet_edit", path: "r.xlsx", ops: [] }));
      await done(await queue(t, { action: "sheet_inspect", path: "r.xlsx" }), {
        status: "done",
        changed: [],
        observation: null,
        detail: {
          workbook: {
            sheet: "Matched",
            sheets: [
              { name: "Matched", rows: 8, filledRows: 8 },
              { name: "Unmatched", rows: 1, filledRows: 1 },
            ],
            cells: [],
          },
        },
      });
      await expect(complete(t)).rejects.toThrow(/Unmatched sheet of r\.xlsx has no rows/);
      await done(await queue(t, { action: "sheet_edit", path: "r.xlsx", ops: [] }));
      await done(await queue(t, { action: "sheet_inspect", path: "r.xlsx" }), book(8));
      await complete(t);
      expect((await statusOf(t)).status).toBe("completed");
    });

    it("refuses a figure or a made file the result states but nothing read (VER-01-01)", async () => {
      const t = await withChecks([{ path: "r.xlsx", cell: "B10", equals: "4520.333" }]);
      const finish = (result: string) =>
        changeTask(rest() as never, rest() as never, A, { id: t, status: "completed", result });
      await done(await queue(t, { action: "sheet_edit", path: "r.xlsx", ops: [] }));
      await done(
        await queue(t, { action: "sheet_inspect", path: "r.xlsx" }),
        sheet({ B10: 4520.333, C3: 0.125 }),
      );
      await settle(
        await queue(t, { action: "file_copy", path: "data.csv", to: "final.xlsx" }),
        "failed",
      );
      await done(await queue(t, { action: "file_info", path: "data.csv" }));
      // The checks pass; the words the person reads still claim what the device never showed.
      await expect(finish("Total 4,520.33 in B10; revenue was 9,705.")).rejects.toThrow(
        /9,705 is not in anything this task read/,
      );
      await expect(finish("Total 4,520 in r.xlsx, copied to final.xlsx.")).rejects.toThrow(
        /final\.xlsx was not read after this task last changed it/,
      );
      // Rounded figures, a share as a percent, dates and small counts are what the reads show.
      await finish("Total ₹4,520.33 (12.5% tax) in r.xlsx on 18 Oct 2026, 3 sheets checked.");
      expect((await statusOf(t)).status).toBe("completed");
    });

    it("reads a dated file name as the file it names, not a figure it claims (HX-03)", async () => {
      const t = await withChecks([{ path: "out/smoke-20261020-01.txt", contains: ["OK"] }]);
      const finish = (result: string) =>
        changeTask(rest() as never, rest() as never, A, { id: t, status: "completed", result });
      await done(
        await queue(t, { action: "file_write", path: "out/smoke-20261020-01.txt", content: "OK" }),
      );
      await done(await queue(t, { action: "file_read", path: "out/smoke-20261020-01.txt" }), {
        status: "done",
        detail: { content: "OK" },
      });
      // The same digits outside the name are still a figure nothing read.
      await expect(finish("Wrote smoke-20261020-01.txt with 20261020 rows.")).rejects.toThrow(
        /20261020 is not in anything this task read/,
      );
      await finish("Wrote smoke-20261020-01.txt (out/smoke-20261020-01.txt) and read it back.");
      expect((await statusOf(t)).status).toBe("completed");
    });

    it("refuses a checked file that is there but empty, such as a model with no triangles", async () => {
      const t = await withChecks([{ path: "car.stl" }]);
      await done(await queue(t, { action: "download", ref: "e1" }));
      const info = (properties: object) => ({
        status: "done",
        detail: { info: { name: "car.stl", size: 84, properties } },
      });
      await done(await queue(t, { action: "file_info", path: "car.stl" }), info({ triangles: 0 }));
      const finish = () =>
        changeTask(rest() as never, rest() as never, A, { id: t, status: "completed" });
      await expect(finish()).rejects.toThrow(/car\.stl is empty/);
      await done(await queue(t, { action: "file_info", path: "car.stl" }), info({ triangles: 12 }));
      await finish();
      expect((await statusOf(t)).status).toBe("completed");
    });

    it("checks each measured property the person asked for in the saved file (MEDIA-22-01)", async () => {
      const t = await withChecks([
        {
          path: "cut.mp4",
          measures: [
            { name: "seconds", min: 119.5, max: 120.5 },
            { name: "truePeakDBTP", max: -1 },
          ],
        },
      ]);
      await done(await queue(t, { action: "run", command: "ffmpeg -i a.mp4 cut.mp4" }));
      const info = (properties: object) => ({
        status: "done",
        detail: { info: { name: "cut.mp4", size: 900, properties } },
      });
      const finish = (result?: string) =>
        changeTask(rest() as never, rest() as never, A, { id: t, status: "completed", result });
      await done(await queue(t, { action: "file_info", path: "cut.mp4" }), info({ seconds: 120 }));
      await expect(finish()).rejects.toThrow(/not measured for truePeakDBTP.*audio: true/);
      await done(
        await queue(t, { action: "file_info", path: "cut.mp4", audio: true }),
        info({ seconds: 120, truePeakDBTP: 0.6 }),
      );
      await expect(finish()).rejects.toThrow(/measures truePeakDBTP 0.6, not … to -1/);
      await done(
        await queue(t, { action: "file_info", path: "cut.mp4", audio: true }),
        info({ seconds: 120.02, truePeakDBTP: -1.2 }),
      );
      // A file the result names that no step made, saw or listed is not said to exist.
      await expect(finish("Saved cut.mp4 and its project cut.mlt.")).rejects.toThrow(
        /cut\.mlt is named in the result, but nothing this task did shows it/,
      );
      await finish("Saved cut.mp4 (see https://example.com/help.pdf).");
      expect((await statusOf(t)).status).toBe("completed");
    });

    it("keeps each delivered file as a Library item named on the completed task", async () => {
      const t = await withChecks([{ path: "car.stl" }]);
      await done(await queue(t, { action: "file_write", path: "car.stl", content: "solid" }));
      await done(await queue(t, { action: "file_read", path: "car.stl" }), {
        status: "done",
        detail: { content: "solid" },
      });
      const item = "cccccccc-2222-4ccc-8ccc-cccccccccccc";
      const sent = { action: "file_deliver", path: "car.stl", size: 5, upload: "https://u", item };
      await done(await queue(t, sent));
      const at = new Date().toISOString();
      const row = await changeTask(rest() as never, rest() as never, A, {
        id: t,
        status: "completed",
        result: "Made car.stl.",
        checkpoint: { step: 1, lastAction: "Finished", lastUrl: null, at },
      });
      expect(row?.checkpoint?.deliverables).toEqual([{ id: item, name: "car.stl" }]);
      const kept = await twin.asServiceRole(
        `select name, source, size_bytes, storage_path, conversation_id from public.ocade_library_items where id = '${item}'`,
      );
      expect(kept).toHaveLength(1);
      expect(kept[0]).toMatchObject({
        name: "car.stl",
        source: "generated",
        storage_path: `${A}/${item}`,
        conversation_id: conversation,
      });
      expect(Number((kept[0] as { size_bytes: unknown }).size_bytes)).toBe(5);
    });

    it("accepts a figure the task's own web research answered (VER-01-01)", async () => {
      const t = await withChecks([{ contains: ["India"] }]);
      await done(await queue(t, { action: "find_text", text: "1.43" }), {
        status: "done",
        detail: { found: ["India"] },
      });
      const finish = () =>
        changeTask(rest() as never, rest() as never, A, {
          id: t,
          status: "completed",
          result: "India has 1.43 billion people.",
        });
      // What the model searched for is not what the page said.
      await expect(finish()).rejects.toThrow(/1\.43 is not in anything this task read/);
      await twin.asServiceRole(
        `insert into public.jarvis_activity (user_id, task_id, summary, action, status, result)
         values ('${A}', '${t}', 'Searched the web', ${lit({ action: "research", question: "q" })},
                 'done', ${lit({ status: "done", answer: "About 1.43 billion [UN](https://un.org)" })})`,
      );
      await finish();
      expect((await statusOf(t)).status).toBe("completed");
    });

    it("refuses a sheet of blank formatted rows under a lone total (live Gemini, 18 Oct)", async () => {
      const t = await withChecks([{ path: "r.xlsx", sheet: "Matched" }]);
      await done(await queue(t, { action: "sheet_edit", path: "r.xlsx", ops: [] }));
      await done(await queue(t, { action: "sheet_inspect", path: "r.xlsx" }), {
        status: "done",
        changed: [],
        observation: null,
        detail: {
          workbook: {
            sheet: "Matched",
            sheets: [{ name: "Matched", rows: 12, filledRows: 1 }],
            cells: [],
          },
        },
      });
      await expect(complete(t)).rejects.toThrow(/Matched sheet of r\.xlsx has no rows below/);
    });

    it.each([undefined, "many", 2.5, -2])(
      "refuses missing or malformed populated-row counts (%s), then accepts a measured count",
      async (count) => {
        for (const changed of [false, true]) {
          const t = await withChecks([{ path: "r.xlsx", sheet: "Matched" }]);
          const inspect = (sheets: object[]) =>
            queue(t, { action: "sheet_inspect", path: "r.xlsx" }).then((id) =>
              done(id, { status: "done", detail: { workbook: { sheets, cells: [] } } }),
            );
          if (changed)
            await done(await queue(t, { action: "sheet_edit", path: "r.xlsx", ops: [] }));
          await inspect([
            { name: "Matched", rows: 12, ...(count === undefined ? {} : { filledRows: count }) },
          ]);
          await expect(complete(t)).rejects.toThrow(/did not report a valid filledRows count/);
          await inspect([{ name: "Matched", rows: 12, filledRows: 3 }]);
          await complete(t);
        }
      },
    );

    it("refuses an edited workbook whose inspection reports no sheets", async () => {
      const t = await withChecks([{ path: "r.xlsx" }]);
      await done(await queue(t, { action: "sheet_edit", path: "r.xlsx", ops: [] }));
      await done(await queue(t, { action: "sheet_inspect", path: "r.xlsx" }), {
        status: "done",
        detail: { workbook: { sheets: [], cells: [] } },
      });
      await expect(complete(t)).rejects.toThrow(/not read with sheet_inspect/);
    });

    it("refuses a task that has no checks, however well it was read back", async () => {
      const t = await task();
      await done(await queue(t, { action: "file_write", path: "a.txt", content: "x" }));
      await done(await queue(t, { action: "file_read", path: "a.txt" }), {
        status: "done",
        detail: { content: "x" },
      });
      expect(await completionGap(rest() as never, A, t)).toBeNull(); // structure alone
      await expect(complete(t)).rejects.toThrow(/no checks for its result/);
    });

    it("does not prove target content using removed text or the other file's comparison values", async () => {
      const t = await withChecks([{ path: "final.txt", contains: ["approved"] }]);
      await done(await queue(t, { action: "file_write", path: "final.txt", content: "rejected" }));
      await done(
        await queue(t, { action: "file_compare", path: "final.txt", to: "baseline.txt" }),
        {
          status: "done",
          detail: { changes: { kind: "lines", lines: ["-rejected", "+approved"], more: 0 } },
        },
      );
      await expect(complete(t)).rejects.toThrow(/content was never read back/);
      await done(await queue(t, { action: "file_read", path: "final.txt" }), {
        status: "done",
        detail: { content: "rejected" },
      });
      await expect(complete(t)).rejects.toThrow(/"approved" is not in final.txt/);
      await done(await queue(t, { action: "file_write", path: "final.txt", content: "approved" }));
      await done(await queue(t, { action: "file_read", path: "final.txt" }), {
        status: "done",
        detail: { content: "approved" },
      });
      await complete(t);
      expect((await statusOf(t)).status).toBe("completed");
    });

    it.each(["done", "123"])(
      "does not count result metadata as file content (%s)",
      async (wanted) => {
        const t = await withChecks([{ path: "a.txt", contains: [wanted] }]);
        await done(await queue(t, { action: "file_read", path: "a.txt" }), {
          status: "done",
          changed: [],
          observation: null,
          detail: { content: "unfinished", ms: 123 },
        });
        await expect(complete(t)).rejects.toThrow(/is not in a.txt/);
      },
    );

    it("does not count an inactive tab's title as active page content", async () => {
      const t = await withChecks([{ contains: ["Order approved"] }]);
      await done(await queue(t, { action: "observe" }), {
        status: "done",
        observation: { text: "Order rejected", tabs: [{ title: "Order approved", active: false }] },
      });
      await expect(complete(t)).rejects.toThrow(/is not in the screen or page/);
    });

    it("counts a document's body words as the device read them, never the model's count (HX-01)", async () => {
      const t = await withChecks([{ path: "essay.docx", minWords: 300 }]);
      await done(await queue(t, { action: "doc_edit", path: "essay.docx", ops: [] }));
      const extract = (bodyWords?: number) =>
        queue(t, { action: "file_extract", path: "essay.docx" }).then((id) =>
          done(id, {
            status: "done",
            detail: { content: "word ".repeat(400), ...(bodyWords ? { bodyWords } : {}) },
          }),
        );
      // Without the device's body count a document's headings could pad its text: not counted.
      await extract();
      await expect(complete(t)).rejects.toThrow(/not read for its word count/);
      await extract(30);
      await expect(complete(t)).rejects.toThrow(/holds 30 body words, not at least 300/);
      await extract(301);
      await complete(t);
      expect((await statusOf(t)).status).toBe("completed");
    });

    it("uses the latest content read when a file or page changes outside the task", async () => {
      for (const path of ["a.txt", null]) {
        const t = await withChecks([{ ...(path ? { path } : {}), contains: ["approved"] }]);
        for (const text of ["approved", "rejected"]) {
          await done(await queue(t, path ? { action: "file_read", path } : { action: "observe" }), {
            status: "done",
            ...(path ? { detail: { content: text } } : { observation: { text } }),
          });
        }
        await expect(complete(t)).rejects.toThrow(/"approved" is not in/);
        await twin.asServiceRole(
          `update public.jarvis_tasks set status = 'stopped' where id = '${t}'`,
        );
      }
    });

    it.each([
      { action: "file_trash", path: "folder" },
      { action: "file_move", path: "folder", to: "archive" },
      { action: "file_copy", path: "replacement", to: "folder" },
      { action: "file_delete", path: "FOLDER\\" },
      { action: "file_trash", path: "." },
    ])("invalidates descendant checks after $action on $path", async (action) => {
      const t = await withChecks([{ path: "folder/a.txt", contains: ["approved"] }]);
      const read = () =>
        queue(t, { action: "file_read", path: "folder/a.txt" }).then((id) =>
          done(id, { status: "done", detail: { content: "approved" } }),
        );
      await read();
      await done(await queue(t, action));
      await done(await queue(t, { action: "file_info", path: "other.txt" }));
      await expect(complete(t)).rejects.toThrow(/folder\/a.txt was not read/);
      await read();
      await complete(t);
      expect((await statusOf(t)).status).toBe("completed");
    });

    it("requires fresh edited-file content after a command, including for recipe proof", async () => {
      const t = await withChecks([{ path: "a.txt", contains: ["approved"] }]);
      const read = () =>
        queue(t, { action: "file_read", path: "a.txt" }).then((id) =>
          done(id, { status: "done", detail: { content: "approved" } }),
        );
      await done(await queue(t, { action: "file_write", path: "a.txt", content: "approved" }));
      await read();
      await done(await queue(t, { action: "run", command: "python update.py" }));
      await done(await queue(t, { action: "observe" }));
      expect(await completionGap(rest() as never, A, t)).toMatch(/content was never read back/);
      await expect(complete(t)).rejects.toThrow(/content was never read back/);
      await read();
      expect(await completionGap(rest() as never, A, t)).toBeNull();
      await complete(t);
    });

    it("keeps a read valid across a command whose complete list of touched files leaves it out (RATE-21-01)", async () => {
      const t = await withChecks([{ path: "a.txt", contains: ["approved"] }]);
      await done(await queue(t, { action: "file_write", path: "a.txt", content: "approved" }));
      await done(await queue(t, { action: "file_read", path: "a.txt" }), {
        status: "done",
        detail: { content: "approved" },
      });
      // A helper script is judged by what it made: it is not read back itself.
      await done(
        await queue(t, { action: "file_write", path: ".jarvis/tidy.py", content: "print(1)" }),
      );
      // The command, then a look at what it made (any read after the last change is needed).
      const run = async (detail: object) => {
        await done(await queue(t, { action: "run", command: "python .jarvis/tidy.py" }), {
          status: "done",
          detail,
        });
        await done(await queue(t, { action: "file_info", path: "other.txt" }));
      };
      await run({ wrote: ["other.txt"], wroteAll: true });
      expect(await completionGap(rest() as never, A, t)).toBeNull();
      // A list that may be incomplete, or one naming the file in any case: read it again.
      for (const detail of [{ wrote: ["other.txt"] }, { wrote: ["A.TXT"], wroteAll: true }]) {
        await run(detail);
        expect(await completionGap(rest() as never, A, t)).toMatch(/a\.txt/);
        await done(await queue(t, { action: "file_read", path: "a.txt" }), {
          status: "done",
          detail: { content: "approved" },
        });
      }
      await complete(t);
    });

    it("does not invalidate a file check for a directory with only a shared prefix", async () => {
      const t = await withChecks([{ path: "folder/a.txt", contains: ["approved"] }]);
      await done(await queue(t, { action: "file_read", path: "folder/a.txt" }), {
        status: "done",
        detail: { content: "approved" },
      });
      await done(await queue(t, { action: "file_trash", path: "folder-other" }));
      await done(await queue(t, { action: "file_info", path: "other.txt" }));
      await complete(t);
      expect((await statusOf(t)).status).toBe("completed");
    });

    it("does not substantiate a final numeric claim from elapsed milliseconds", async () => {
      const t = await withChecks([{ path: "a.txt", contains: ["unfinished"] }]);
      await done(await queue(t, { action: "file_read", path: "a.txt" }), {
        status: "done",
        detail: { content: "unfinished", ms: 123 },
      });
      await expect(
        changeTask(rest() as never, rest() as never, A, {
          id: t,
          status: "completed",
          result: "Processed 123 items.",
        }),
      ).rejects.toThrow(/123 is not in anything this task read/);
    });

    it("invalidates numeric evidence when a later command could have changed its file", async () => {
      const t = await withChecks([{ path: "b.txt" }]);
      await done(await queue(t, { action: "file_read", path: "a.txt" }), {
        status: "done",
        detail: { content: "123" },
      });
      await done(await queue(t, { action: "run", command: "python update.py" }));
      await done(await queue(t, { action: "file_info", path: "b.txt" }));
      await expect(
        changeTask(rest() as never, rest() as never, A, {
          id: t,
          status: "completed",
          result: "The total is 123.",
        }),
      ).rejects.toThrow(/123 is not in anything this task read/);
    });

    it("keeps STOP when it lands between verification and the completion write", async () => {
      const t = await withChecks([{ path: "a.txt" }]);
      await done(await queue(t, { action: "file_info", path: "a.txt" }));
      let intercepted = false;
      const concurrent = restOver({
        async asServiceRole(sql: string) {
          if (/^update public\.jarvis_tasks set .*status = 'completed'/.test(sql)) {
            intercepted = true;
            await twin.asServiceRole(
              `update public.jarvis_tasks set status = 'stopped' where id = '${t}'`,
            );
          }
          return twin.asServiceRole(sql);
        },
      } as DatabaseTwin);
      expect(
        await changeTask(rest() as never, concurrent as never, A, { id: t, status: "completed" }),
      ).toBeNull();
      expect(intercepted).toBe(true);
      expect((await statusOf(t)).status).toBe("stopped");
      const charges = await twin.asServiceRole(
        `select * from public.ocade_jarvis_task_charges where task_id = '${t}'`,
      );
      expect(charges).toHaveLength(0);
    });

    it("does not let a stale waiting-task resume overwrite a newer STOP", async () => {
      const t = await withChecks([{ path: "a.txt" }]);
      await twin.asServiceRole(
        `update public.jarvis_tasks set status = 'stopped' where id = '${t}'`,
      );
      expect(
        await changeTask(rest() as never, rest() as never, A, {
          id: t,
          status: "running",
          expectedStatus: "waiting",
          controller: A,
        }),
      ).toBeNull();
      expect((await statusOf(t)).status).toBe("stopped");
    });

    it.each(["stopped", "waiting", "taken_over", "failed", "blocked"])(
      "refuses direct service completion from %s in the database without charging",
      async (state) => {
        const t = await withChecks([{ path: "a.txt" }]);
        await done(await queue(t, { action: "file_info", path: "a.txt" }));
        await twin.asServiceRole(
          `update public.jarvis_tasks set status = '${state}' where id = '${t}'`,
        );
        await expect(
          twin.asServiceRole(
            `update public.jarvis_tasks set status = 'completed', verified_actions = 1 where id = '${t}'`,
          ),
        ).rejects.toThrow(/Only a running task can complete/);
        expect((await statusOf(t)).status).toBe(state);
        const charges = await twin.asServiceRole(
          `select * from public.ocade_jarvis_task_charges where task_id = '${t}'`,
        );
        expect(charges).toHaveLength(0);
      },
    );

    it("verifies the completion guard, detects disabling it and survives rollback/reapplication", async () => {
      const migration = "20261019104555_completion_cannot_revive_a_stopped_task";
      const verify = () => twin.runScript("supabase/verification", `${migration}_verify.sql`);
      const t = await withChecks([{ path: "a.txt" }]);
      await done(await queue(t, { action: "file_info", path: "a.txt" }));
      await twin.asServiceRole(
        `update public.jarvis_tasks set status = 'stopped' where id = '${t}'`,
      );
      try {
        expect(await verify()).toEqual({ ok: true });
        await twin.execSuperuser(
          "alter table public.jarvis_tasks disable trigger jarvis_completion_requires_running",
        );
        expect((await verify()).ok).toBe(false);
        for (let i = 0; i < 2; i++) {
          expect(await twin.runScript("supabase/rollback", `${migration}_rollback.sql`)).toEqual({
            ok: true,
          });
        }
        expect((await verify()).ok).toBe(false);
      } finally {
        // Restore the shared twin even if an assertion fails with the guard disabled.
        await twin.runScript("supabase/rollback", `${migration}_rollback.sql`);
        expect(await twin.runScript("supabase/migrations", `${migration}.sql`)).toEqual({
          ok: true,
        });
      }
      expect(await verify()).toEqual({ ok: true });
      expect((await statusOf(t)).status).toBe("stopped");
      await expect(
        twin.asServiceRole(
          `update public.jarvis_tasks set status = 'completed', verified_actions = 1 where id = '${t}'`,
        ),
      ).rejects.toThrow(/Only a running task can complete/);
      expect(
        await twin.asServiceRole(
          `select * from public.ocade_jarvis_task_charges where task_id = '${t}'`,
        ),
      ).toHaveLength(0);
    });

    it("refuses the right words with the wrong total, then completes once the cell is right", async () => {
      const t = await withChecks([{ path: "r.xlsx", cell: "B10", equals: "4520" }]);
      await done(await queue(t, { action: "sheet_edit", path: "r.xlsx", ops: [] }));
      await done(
        await queue(t, { action: "sheet_inspect", path: "r.xlsx" }),
        sheet({ A10: "Grand Total", B10: 4250 }),
      );
      await expect(complete(t)).rejects.toThrow(/B10 of r\.xlsx shows 4250, not "4520"/);
      await done(await queue(t, { action: "sheet_edit", path: "r.xlsx", ops: [] }));
      await done(
        await queue(t, { action: "sheet_inspect", path: "r.xlsx" }),
        sheet({ A10: "Grand Total", B10: 4520 }),
      );
      await complete(t);
      expect(await statusOf(t)).toEqual({ status: "completed", verified_actions: 4 });
    });

    it("refuses a check met only by another file, another sheet or a read before the last change", async () => {
      const t = await withChecks([
        { path: "r.xlsx", contains: ["Total"] },
        { path: "r.xlsx", sheet: "Summary", cell: "A1", equals: "Done" },
      ]);
      await done(await queue(t, { action: "sheet_edit", path: "r.xlsx", ops: [] }));
      await done(
        await queue(t, { action: "sheet_inspect", path: "old.xlsx" }),
        sheet({ A1: "Total" }),
      );
      await expect(complete(t)).rejects.toThrow(/content was never read back/);
      await done(
        await queue(t, { action: "sheet_inspect", path: "r.xlsx" }),
        sheet({ A1: "Total" }),
      );
      // The first sheet was read; the check names Summary.
      await expect(complete(t)).rejects.toThrow(/A1 of r\.xlsx \(Summary\) was not read/);
      await done(
        await queue(t, { action: "sheet_inspect", path: "r.xlsx", sheet: "Summary" }),
        sheet({ A1: "Done" }, "Summary"),
      );
      // A command could have changed any file: what was read before it no longer counts.
      await done(await queue(t, { action: "run", command: "python tidy.py" }));
      await done(await queue(t, { action: "file_info", path: "r.xlsx" }));
      await expect(complete(t)).rejects.toThrow(/content was never read back/);
      // Another spelling is another file: only the submitted path proves it.
      await done(await queue(t, { action: "file_read", path: "R.XLSX" }), {
        status: "done",
        detail: { content: "Total" },
      });
      await expect(complete(t)).rejects.toThrow(/content was never read back/);
      await done(await queue(t, { action: "file_read", path: "r.xlsx" }), {
        status: "done",
        detail: { content: "Total" },
      });
      await expect(complete(t)).rejects.toThrow(/not read with sheet_inspect/);
      await done(
        await queue(t, { action: "sheet_inspect", path: "r.xlsx", sheet: "Summary" }),
        sheet({ A1: "Done" }, "Summary"),
      );
      // A fresh full-file read must substantiate the content check; an older
      // sheet preview cannot mask a later snapshot that no longer shows Total.
      await expect(complete(t)).rejects.toThrow(/"Total" is not in r.xlsx/);
      await done(await queue(t, { action: "file_extract", path: "r.xlsx" }), {
        status: "done",
        detail: { content: "Total\nSummary\nDone" },
      });
      await complete(t);
      expect((await statusOf(t)).status).toBe("completed");
    });

    it("checks a page by what was read after the last thing done in the browser", async () => {
      const t = await withChecks([{ contains: ["Order 1234 placed"] }]);
      await done(await queue(t, { action: "observe" }), {
        status: "done",
        observation: { text: "Order 1234 placed" },
      });
      await done(await queue(t, { action: "click", ref: "e1", observationId: "o1" }));
      // Playing a video is a change, not a read.
      await done(await queue(t, { action: "media", op: "play" }));
      await expect(complete(t)).rejects.toThrow(/nothing has read the result back/);
      await done(await queue(t, { action: "media", op: "state" }), {
        status: "done",
        detail: { media: { paused: false, currentTime: 0, duration: 120 } },
      });
      await expect(complete(t)).rejects.toThrow(/"Order 1234 placed" is not in the screen or page/);
      await done(await queue(t, { action: "find_text", text: "Order" }), {
        status: "done",
        detail: { found: ["Order 1234 placed"] },
      });
      await complete(t);
      expect((await statusOf(t)).status).toBe("completed");
    });

    it("does not let an action stopped while the device held it pass unread", async () => {
      const t = await withChecks([{ path: "b.txt" }]);
      const write = await queue(t, { action: "file_write", path: "a.txt", content: "x" });
      await settle(write, "claimed");
      await settle(write, "cancelled"); // the database keeps it as unknown
      expect((await status(write)).result).toEqual({ status: "unknown" });
      await done(await queue(t, { action: "file_info", path: "b.txt" }));
      await expect(complete(t)).rejects.toThrow(/outcome is unknown.*Read a\.txt again/);
      await done(await queue(t, { action: "file_read", path: "a.txt" }), {
        status: "done",
        detail: { content: "x" },
      });
      await complete(t);
      expect((await statusOf(t)).status).toBe("completed");
    });

    it("checks every action of a long task instead of refusing past 1,000", async () => {
      const t = await withChecks([{ path: "a.txt" }]);
      await twin.asServiceRole(
        `insert into public.jarvis_activity (user_id, task_id, device_id, summary, action, status, result, created_at)
         select '${A}', '${t}', '${device}', 's', '{"action":"file_info","path":"a.txt"}'::jsonb,
                'done', '{"status":"done"}'::jsonb, now() - interval '1 hour' + n * interval '1 ms'
           from generate_series(1, 1100) as n`,
      );
      const last = await queue(t, { action: "file_write", path: "a.txt", content: "x" });
      await expect(complete(t)).rejects.toThrow(/has not finished/); // the 1,101st is seen
      await done(last);
      await done(await queue(t, { action: "file_read", path: "a.txt" }), {
        status: "done",
        detail: { content: "x" },
      });
      await complete(t);
      expect(await statusOf(t)).toEqual({ status: "completed", verified_actions: 1102 });
    }, 60_000);

    it("refuses, in the database, a completion that does not match the actions checked", async () => {
      const t = await withChecks([{ path: "a.txt" }]);
      await done(await queue(t, { action: "file_info", path: "a.txt" }));
      expect(await completionGap(rest() as never, A, t, [{ path: "a.txt" }])).toBeNull();
      // An action queued after that check: the count written with completed is stale.
      await queue(t, { action: "file_write", path: "a.txt", content: "late" });
      const stale = await twin
        .asServiceRole(
          `update public.jarvis_tasks set status = 'completed', verified_actions = 1 where id = '${t}'`,
        )
        .catch((error: Error) => error);
      expect(String(stale)).toMatch(/changed after its result was checked/);
      expect((await statusOf(t)).status).toBe("running");
    });

    it("queues nothing on a completed task, and nobody can change its checks", async () => {
      const t = await withChecks([{ path: "a.txt" }]);
      await done(await queue(t, { action: "file_info", path: "a.txt" }));
      await complete(t);
      await expect(queue(t, { action: "file_write", path: "a.txt", content: "x" })).rejects.toThrow(
        /That task is completed/,
      );
      const asService = await twin
        .asServiceRole(
          `update public.jarvis_tasks set outcome = '[{"path":"b.txt"}]'::jsonb where id = '${t}'`,
        )
        .catch((error: Error) => error);
      expect(String(asService)).toMatch(/fixed when it starts/);
      const asPerson = await twin.asTenant(
        A,
        `update public.jarvis_tasks set outcome = null where id = '${t}'`,
      );
      expect(asPerson.errorCode).toBe("42501");
    });
  });

  it("is enforced by the database: the person's own client cannot set completed", async () => {
    const t = await task();
    const direct = await twin.asTenant(
      A,
      `update public.jarvis_tasks set status = 'completed' where id = '${t}'`,
    );
    expect(direct.errorCode).toBe("42501");
    const stop = await twin.asTenant(
      A,
      `update public.jarvis_tasks set status = 'stopped' where id = '${t}'`,
    );
    expect(stop.error).toBeUndefined();
  });

  it("accepts a change read back successfully, ignoring refused steps that never ran", async () => {
    const t = await task();
    await settle(await queue(t, { action: "file_write", path: "a.txt", content: "x" }), "done");
    await settle(await queue(t, { action: "file_read", path: "a.txt" }), "done");
    await settle(await queue(t, { action: "run", command: "rm -rf /" }), "failed", {
      status: "refused",
    });
    expect(await gap(t)).toBeNull();
  });

  it("ignores a step the person declined, but not one the device stopped part-way", async () => {
    const t = await task();
    await settle(await queue(t, { action: "file_write", path: "a.txt", content: "x" }), "done");
    await settle(await queue(t, { action: "file_read", path: "a.txt" }), "done");
    const push = await queue(t, { action: "run", command: "git push origin main" });
    await settle(push, "cancelled");
    expect(await gap(t)).toBeNull();
    await settle(push, "cancelled", { status: "cancelled" });
    expect(await gap(t)).toMatch(/read the result back/);
  });
});

describe("the emergency stop", () => {
  it("hands out nothing and cancels running work while execution is disabled", async () => {
    const t = await task();
    await permit("files", true);
    const running = await queue(t, { action: "file_list", path: "." });
    await run({ results: [] });
    await queue(t, { action: "file_list", path: "src" });
    process.env.JARVIS_EXECUTION_DISABLED = "1";
    try {
      const reply = await run({ results: [], running: [running] });
      expect(reply.cancel).toEqual([running]);
      expect((await run({ results: [] })).commands).toEqual([]);
    } finally {
      delete process.env.JARVIS_EXECUTION_DISABLED;
    }
  });
});

describe("a result the device got slightly wrong", () => {
  it("is kept, never rejecting the batch the device would resend forever", async () => {
    const { exchangeInput } = await import("../device.server");
    const parsed = exchangeInput.parse({
      results: [
        {
          id: "0276ec3b-3462-468d-864b-bd218fd7d28e",
          status: "failed",
          summary: "x".repeat(900),
          changed: true,
        },
      ],
    });
    expect(parsed.results[0]!.summary).toHaveLength(300);
    expect(parsed.results[0]!.changed).toBeUndefined();
  });
});

describe("the live picture (C24)", () => {
  it("shows when the device captured it, and a late older picture never replaces a newer one", async () => {
    const t = await task();
    const frame = async () =>
      (
        await twin.asServiceRole<{ live_frame: string; at: number }>(
          `select live_frame, (extract(epoch from live_frame_at) * 1000)::float8 as at
             from public.jarvis_tasks where id = '${t}'`,
        )
      )[0]!;
    const newer = new Date(Date.now() - 2_000).toISOString();
    const older = new Date(Date.now() - 9_000).toISOString();
    await run({ results: [], frame: { taskId: t, jpeg: "bmV3", capturedAt: newer } });
    expect((await frame()).at).toBe(Date.parse(newer));
    await run({ results: [], frame: { taskId: t, jpeg: "b2xk", capturedAt: older } });
    expect((await frame()).live_frame).toBe("bmV3");
    // A device clock ahead of the server is never shown as a time still to come.
    await run({
      results: [],
      frame: { taskId: t, jpeg: "ZnV0", capturedAt: new Date(Date.now() + 60_000).toISOString() },
    });
    expect((await frame()).at).toBeLessThanOrEqual(Date.now());
  });
});

describe("a step the device lost (killed before recording it)", () => {
  it("is settled unknown at the device's next exchange, not left claimed for minutes", async () => {
    const t = await task();
    await permit("files", true);
    const id = await queue(t, { action: "file_list", path: "." });
    expect((await run({ results: [] })).commands.map((c) => c.id)).toEqual([id]);
    // Still running on the device: left alone.
    await run({ results: [], running: [id] });
    expect((await status(id)).status).toBe("claimed");
    // Restarted without it, and nothing reported: the device does not have it.
    await run({ results: [], running: [] });
    const row = await status(id);
    expect(row.status).toBe("failed");
    expect(row.result).toEqual({ status: "unknown" });
  });
});

describe("results (JARVIS-027)", () => {
  it("answers every reported result: kept, stopped, or unknown", async () => {
    const t = await task();
    await permit("files", true);
    const id = await queue(t, { action: "file_list", path: "." });
    await run({ results: [] });
    const unknown = "0276ec3b-3462-468d-864b-bd218fd7d28e";
    const reply = await run({
      results: [
        { id, status: "done" },
        { id: unknown, status: "done" },
      ],
    });
    expect(reply.acks).toEqual([
      { id, outcome: "accepted" },
      { id: unknown, outcome: "unknown" },
    ]);
  });
});

describe("enrollment is public, so one source cannot fill it", () => {
  it("refuses one more pending enrollment from a full source while others still get in", async () => {
    const [crowded, other] = ["a".repeat(64), "b".repeat(64)];
    for (let i = 0; i < MAX_PENDING_PER_SOURCE; i += 1) {
      await twin.asServiceRole(
        `insert into public.jarvis_devices (name, public_key, enrollment_expires_at, enrollment_source)
         values ('Pending', '${"p".repeat(90)}${i}', now() + interval '10 minutes', '${crowded}')`,
      );
    }
    try {
      expect(await enrollmentRoom(rest() as never, crowded)).toBe(false);
      expect(await enrollmentRoom(rest() as never, other)).toBe(true);
    } finally {
      await twin.asServiceRole(`delete from public.jarvis_devices where user_id is null`);
    }
  });

  it("keeps the source private to the server", async () => {
    const read = await twin.asTenant(A, `select enrollment_source from public.jarvis_devices`);
    expect(read).toMatchObject({ errorCode: "42501" });
  });
});
