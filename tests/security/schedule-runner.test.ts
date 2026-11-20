/**
 * The scheduled-work sweep (REPO-60/70): a reminder is written once and notified; scheduled work
 * starts a NEW task through the normal starter (fresh checks) and links the occurrence; a refusal
 * is recorded and told, never retried around; a busy computer skips the run; a technical failure
 * is left claimed for the database to retry, then given up after an hour; a run whose task
 * already exists is not started twice; repeats move to their next local time.
 * The database steps themselves are tested in tests/jarvis/db/schedules.test.sql.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

type Runner = typeof import("../../src/lib/jarvis/schedules.server.ts");
let runner: Runner;
let workDir: string;
const ROOT = path.resolve(import.meta.dirname, "../..");

before(async () => {
  workDir = mkdtempSync(path.join(tmpdir(), "ocade-schedules-"));
  const outfile = path.join(workDir, "runner.mjs");
  await build({
    entryPoints: [path.join(ROOT, "src/lib/jarvis/schedules.server.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    tsconfig: path.join(ROOT, "tsconfig.json"),
    // Injected in every test; the real ones are never loaded here.
    external: ["./authority.server", "@/lib/notifications/send.server"],
    logLevel: "silent",
  });
  runner = await import(pathToFileURL(outfile).href);
});
after(() => rmSync(workDir, { recursive: true, force: true }));

class Refusal extends Error {}

function fakeAdmin(claimed: Record<string, unknown>[], existingTask = false) {
  const finished: Record<string, unknown>[] = [];
  const messages: Record<string, unknown>[] = [];
  const linked: string[] = [];
  const admin = {
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === "jarvis_claim_due_schedules") return { data: claimed, error: null };
      if (name === "jarvis_finish_schedule") {
        finished.push(args);
        return { data: true, error: null };
      }
      throw new Error(`unexpected rpc ${name}`);
    },
    from(table: string) {
      return {
        async insert(row: Record<string, unknown>) {
          if (messages.some((m) => m.client_key === row.client_key)) {
            return { error: { message: "duplicate key value violates unique constraint" } };
          }
          messages.push(row);
          return { error: null };
        },
        select() {
          return {
            eq: () => ({
              maybeSingle: async () => ({ data: existingTask ? { id: "old-task" } : null }),
            }),
          };
        },
        update(values: Record<string, unknown>) {
          return {
            eq: (_column: string, id: string) => ({
              is: async () => {
                if (table === "jarvis_tasks") linked.push(`${id}=${values.schedule_occurrence}`);
                return { error: null };
              },
            }),
          };
        },
      };
    },
  };
  return { admin, finished, messages, linked };
}

const row = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  user_id: "u1",
  conversation_id: "c1",
  device_id: "d1",
  what: "Tidy the downloads folder",
  repeat: "daily",
  time_zone: "Asia/Kolkata",
  occurrence: "2026-11-20T03:30:00.000Z",
  ...over,
});
const NOW = new Date("2026-11-20T03:30:30.000Z");

test("scheduled work starts a new task through the normal starter and links the run", async () => {
  const fake = fakeAdmin([row()]);
  const started: unknown[] = [];
  const notices: { title: string; idempotencyKey: string }[] = [];
  const sweep = await runner.runDueSchedules(fake.admin as never, {
    now: NOW,
    startTask: async (_admin, userId, input) => {
      started.push({ userId, ...input });
      return { taskId: "t1", reused: false };
    },
    isRefusal: (e) => e instanceof Refusal,
    notify: async (n) => notices.push(n as never),
  });
  assert.equal(sweep.started, 1);
  assert.deepEqual(started, [
    { userId: "u1", conversationId: "c1", deviceId: "d1", objective: "Tidy the downloads folder" },
  ]);
  assert.deepEqual(fake.linked, ["t1=schedule:s1:2026-11-20T03:30:00.000Z"]);
  assert.equal(fake.finished[0]!.p_next_at, "2026-11-21T03:30:00.000Z", "next 09:00 Kolkata");
  assert.equal(fake.finished[0]!.p_outcome, "Task started");
  assert.equal(notices[0]!.idempotencyKey, "schedule:s1:2026-11-20T03:30:00.000Z");
});

test("a reminder is written into its conversation once, even when the run repeats", async () => {
  const reminder = row({ device_id: null, repeat: "none", what: "Call the bank" });
  const fake = fakeAdmin([reminder, reminder]);
  const sweep = await runner.runDueSchedules(fake.admin as never, {
    now: NOW,
    startTask: async () => assert.fail("a reminder started a task"),
    isRefusal: () => false,
    notify: async () => undefined,
  });
  assert.equal(sweep.reminded, 2);
  assert.equal(fake.messages.length, 1);
  assert.equal(fake.messages[0]!.content, "Reminder: Call the bank");
  assert.equal(fake.finished[0]!.p_next_at, null, "a one-time schedule ends");
});

test("a refusal (e.g. permission removed) is recorded and told, not retried", async () => {
  const fake = fakeAdmin([row()]);
  const notices: { body?: string }[] = [];
  const sweep = await runner.runDueSchedules(fake.admin as never, {
    now: NOW,
    startTask: async () => {
      throw new Refusal("Turn on file access for that computer first.");
    },
    isRefusal: (e) => e instanceof Refusal,
    notify: async (n) => notices.push(n),
  });
  assert.equal(sweep.refused, 1);
  assert.equal(fake.finished[0]!.p_outcome, "Turn on file access for that computer first.");
  assert.match(notices[0]!.body!, /file access/);
});

test("a busy computer skips the run instead of joining the person's task", async () => {
  const fake = fakeAdmin([row()]);
  const sweep = await runner.runDueSchedules(fake.admin as never, {
    now: NOW,
    startTask: async () => ({ taskId: "theirs", reused: true }),
    isRefusal: () => false,
    notify: async () => undefined,
  });
  assert.equal(sweep.refused, 1);
  assert.deepEqual(fake.linked, [], "the person's own task is never marked as the schedule's");
  assert.match(String(fake.finished[0]!.p_outcome), /already running a task/);
});

test("a technical failure is left claimed for an hour, then given up", async () => {
  const fail = async () => {
    throw new Error("network");
  };
  const early = fakeAdmin([row()]);
  const first = await runner.runDueSchedules(early.admin as never, {
    now: NOW,
    startTask: fail,
    isRefusal: () => false,
    notify: async () => undefined,
  });
  assert.equal(first.retrying, 1);
  assert.equal(early.finished.length, 0, "left claimed for the database to offer again");

  const late = fakeAdmin([row()]);
  const second = await runner.runDueSchedules(late.admin as never, {
    now: new Date("2026-11-20T05:00:00.000Z"),
    startTask: fail,
    isRefusal: () => false,
    notify: async () => undefined,
  });
  assert.equal(second.refused, 1);
  assert.equal(late.finished.length, 1);
});

test("a run whose task already exists is not started again", async () => {
  const fake = fakeAdmin([row()], true);
  await runner.runDueSchedules(fake.admin as never, {
    now: NOW,
    startTask: async () => assert.fail("started a second task for one run"),
    isRefusal: () => false,
    notify: async () => undefined,
  });
  assert.equal(fake.finished[0]!.p_outcome, "Task started");
});
