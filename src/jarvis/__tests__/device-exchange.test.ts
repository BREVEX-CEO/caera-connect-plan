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
    expect(row.result).toEqual({ status: "stopped", late: "done" });
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
    await settle(await queue(t, { action: "file_info", path: "a.txt" }), "done");
    expect(await save()).toMatchObject({ ok: true });
  });

  it("refuses when a different file was read than the one changed", async () => {
    const t = await task();
    await settle(await queue(t, { action: "file_write", path: "a.txt", content: "x" }), "done");
    await settle(await queue(t, { action: "file_info", path: "b.txt" }), "done");
    expect(await gap(t)).toMatch(/a\.txt was changed but never read back/);
  });

  it("accepts a change read back successfully, ignoring refused steps that never ran", async () => {
    const t = await task();
    await settle(await queue(t, { action: "file_write", path: "a.txt", content: "x" }), "done");
    await settle(await queue(t, { action: "file_info", path: "a.txt" }), "done");
    await settle(await queue(t, { action: "run", command: "rm -rf /" }), "failed", {
      status: "refused",
    });
    expect(await gap(t)).toBeNull();
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
