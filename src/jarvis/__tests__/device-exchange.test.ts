import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DatabaseTwin } from "../../../scripts/db-twin.mts";
import { exchange } from "../device.server";

/**
 * The device exchange against real PostgreSQL with the real migrations
 * (Error Audit 01: JARVIS-023 active STOP, JARVIS-054 permission at dispatch).
 * A tiny PostgREST-shaped adapter runs the exact queries `exchange` builds.
 */
let twin: DatabaseTwin;
const A = "aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa";
let device: string;
let conversation: string;

const lit = (v: unknown): string =>
  v === null
    ? "null"
    : typeof v === "number" || typeof v === "boolean"
      ? String(v)
      : typeof v === "object"
        ? `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
        : `'${String(v).replace(/'/g, "''")}'`;

function rest() {
  return {
    from(table: string) {
      const where: string[] = [];
      let verb: "select" | "update" | "delete" | "insert" = "select";
      let columns = "*";
      let patch: Record<string, unknown> = {};
      let tail = "";
      let returning = false;
      let one: "single" | "maybe" | null = null;
      const q = {
        select(cols = "*") {
          columns = cols;
          returning = verb !== "select";
          return q;
        },
        update(p: Record<string, unknown>) {
          verb = "update";
          patch = p;
          return q;
        },
        delete() {
          verb = "delete";
          return q;
        },
        insert(p: Record<string, unknown>) {
          verb = "insert";
          patch = p;
          return q;
        },
        eq: (c: string, v: unknown) => (where.push(`${c} = ${lit(v)}`), q),
        neq: (c: string, v: unknown) => (where.push(`${c} <> ${lit(v)}`), q),
        lt: (c: string, v: unknown) => (where.push(`${c} < ${lit(v)}`), q),
        is: (c: string, v: unknown) => (where.push(`${c} is ${lit(v)}`), q),
        in: (c: string, vs: unknown[]) => (
          where.push(vs.length ? `${c} in (${vs.map(lit).join(",")})` : "false"),
          q
        ),
        order: (c: string, o: { ascending: boolean }) => (
          (tail += ` order by ${c} ${o.ascending ? "asc" : "desc"}`),
          q
        ),
        limit: (n: number) => ((tail += ` limit ${n}`), q),
        maybeSingle: () => ((one = "maybe"), q),
        single: () => ((one = "single"), q),
        then(resolve: (r: unknown) => void, reject: (e: unknown) => void) {
          const w = where.length ? ` where ${where.join(" and ")}` : "";
          const t = `public.${table}`;
          const sql =
            verb === "select"
              ? `select ${columns} from ${t}${w}${tail}`
              : verb === "update"
                ? `update ${t} set ${Object.entries(patch)
                    .map(([k, v]) => `${k} = ${lit(v)}`)
                    .join(", ")}${w}${returning ? ` returning ${columns}` : ""}`
                : verb === "delete"
                  ? `delete from ${t}${w}`
                  : `insert into ${t} (${Object.keys(patch).join(",")}) values (${Object.values(
                      patch,
                    )
                      .map(lit)
                      .join(",")}) returning ${columns}`;
          twin.asServiceRole(sql).then(
            (rows) => resolve({ data: one ? (rows[0] ?? null) : rows, error: null }),
            (error) => (one ? reject(error) : resolve({ data: null, error })),
          );
        },
      };
      return q;
    },
  };
}

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
