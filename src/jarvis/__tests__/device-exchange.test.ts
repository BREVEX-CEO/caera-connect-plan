import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../scripts/db-twin.mts";
import { enrollmentRoom, exchange, MAX_PENDING_PER_SOURCE } from "../device.server";
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
    `insert into public.jarvis_activity (user_id, task_id, device_id, summary, action, status, confirmed)
     values ('${A}', '${taskId}', '${device}', 's', ${lit(action)}, 'queued', ${confirmed})
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
});

describe("STOP", () => {
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
    await twin.asServiceRole(`update public.jarvis_tasks set status = 'stopped' where id = '${t}'`);
    const third = await queue(t, { action: "file_list", path: "c" });
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

  it("refuses when a different file was read than the one changed", async () => {
    const t = await task();
    await settle(await queue(t, { action: "file_write", path: "a.txt", content: "x" }), "done");
    await settle(await queue(t, { action: "file_read", path: "b.txt" }), "done");
    expect(await gap(t)).toMatch(/a\.txt was changed but its content was never read back/);
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
          sheets: [{ name: "Sheet1" }, { name: "Summary" }],
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

    it("refuses a task that has no checks, however well it was read back", async () => {
      const t = await task();
      await done(await queue(t, { action: "file_write", path: "a.txt", content: "x" }));
      await done(await queue(t, { action: "file_read", path: "a.txt" }), {
        status: "done",
        text: "x",
      });
      expect(await completionGap(rest() as never, A, t)).toBeNull(); // structure alone
      await expect(complete(t)).rejects.toThrow(/no checks for its result/);
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
      await expect(complete(t)).rejects.toThrow(/r\.xlsx was not read for its content/);
      await done(await queue(t, { action: "file_read", path: "R.XLSX" }), {
        status: "done",
        text: "Total",
      });
      await expect(complete(t)).rejects.toThrow(/A1 of r\.xlsx \(Summary\) was not read/);
      await done(
        await queue(t, { action: "sheet_inspect", path: "r.xlsx", sheet: "Summary" }),
        sheet({ A1: "Done" }, "Summary"),
      );
      await complete(t);
      expect((await statusOf(t)).status).toBe("completed");
    });

    it("checks a page by what was read after the last thing done in the browser", async () => {
      const t = await withChecks([{ contains: ["Order 1234 placed"] }]);
      await done(await queue(t, { action: "observe" }), {
        status: "done",
        text: "Order 1234 placed",
      });
      await done(await queue(t, { action: "click", ref: "e1", observationId: "o1" }));
      // Playing a video is a change, not a read.
      await done(await queue(t, { action: "media", op: "play" }));
      await expect(complete(t)).rejects.toThrow(/nothing has read the result back/);
      await done(await queue(t, { action: "media", op: "state" }), {
        status: "done",
        text: "playing",
      });
      await expect(complete(t)).rejects.toThrow(/"Order 1234 placed" is not in the screen or page/);
      await done(await queue(t, { action: "find_text", text: "Order" }), {
        status: "done",
        text: "Order 1234 placed",
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
        text: "x",
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
        text: "x",
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
