/**
 * The scheduled-work sweep (REPO-60/70) runs and finishes only the current claim. A refusal
 * is recorded and told. A technical failure is left claimed for retry for up to an hour.
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

function fakeAdmin(claimed: Record<string, unknown>[], finishAccepted = true) {
  const finished: Record<string, unknown>[] = [];
  const admin = {
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === "jarvis_claim_due_schedules") return { data: claimed, error: null };
      if (name === "jarvis_finish_schedule") {
        finished.push(args);
        return { data: finishAccepted, error: null };
      }
      throw new Error(`unexpected rpc ${name}`);
    },
  };
  return { admin, finished };
}

const row = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  user_id: "u1",
  what: "Tidy the downloads folder",
  repeat: "daily",
  time_zone: "Asia/Kolkata",
  occurrence: "2026-11-20T03:30:00.000Z",
  claim_token: "lease1",
  occurrence_key: "schedule:s1:2026-11-20T03:30:00.000Z",
  ...over,
});
const NOW = new Date("2026-11-20T03:30:30.000Z");

test("an invalidated claim cannot start, finish or publish a notification", async () => {
  const fake = fakeAdmin([row()]);
  const sweep = await runner.runDueSchedules(fake.admin as never, {
    now: NOW,
    runOccurrence: async () => ({ kind: "stale" }),
    isRefusal: () => false,
    notify: async () => assert.fail("a stale claim notified"),
  });
  assert.deepEqual(sweep, { claimed: 1, started: 0, reminded: 0, refused: 0, retrying: 0 });
  assert.equal(fake.finished.length, 0);
});

test("a claim edited between the run and finish emits no stale notification", async () => {
  const fake = fakeAdmin([row()], false);
  const sweep = await runner.runDueSchedules(fake.admin as never, {
    now: NOW,
    runOccurrence: async () => ({ kind: "task" }),
    isRefusal: () => false,
    notify: async () => assert.fail("an edited schedule sent a stale notification"),
  });
  assert.equal(sweep.started, 0);
  assert.equal(fake.finished.length, 1);
});

test("scheduled work runs and finishes the same lease, then notifies", async () => {
  const fake = fakeAdmin([row()]);
  const started: unknown[] = [];
  const notices: { title: string; idempotencyKey: string }[] = [];
  const sweep = await runner.runDueSchedules(fake.admin as never, {
    now: NOW,
    runOccurrence: async (_admin, userId, input) => {
      started.push({ userId, ...input });
      return { kind: "task" };
    },
    isRefusal: (e) => e instanceof Refusal,
    notify: async (n) => notices.push(n as never),
  });
  assert.equal(sweep.started, 1);
  assert.deepEqual(started, [
    { userId: "u1", id: "s1", occurrence: "2026-11-20T03:30:00.000Z", token: "lease1" },
  ]);
  assert.equal(fake.finished[0]!.p_claim_token, "lease1");
  assert.equal(fake.finished[0]!.p_next_at, "2026-11-21T03:30:00.000Z", "next 09:00 Kolkata");
  assert.equal(fake.finished[0]!.p_outcome, "Task started");
  assert.equal(notices[0]!.idempotencyKey, "schedule:s1:2026-11-20T03:30:00.000Z");
});

test("a successful reminder notifies and ends a one-time schedule", async () => {
  const fake = fakeAdmin([row({ repeat: "none", what: "Call the bank" })]);
  const notices: { title: string; body?: string }[] = [];
  const sweep = await runner.runDueSchedules(fake.admin as never, {
    now: NOW,
    runOccurrence: async () => ({ kind: "reminder" }),
    isRefusal: () => false,
    notify: async (notice) => notices.push(notice),
  });
  assert.equal(sweep.reminded, 1);
  assert.equal(notices[0]?.title, "Reminder");
  assert.equal(notices[0]?.body, "Call the bank");
  assert.equal(fake.finished[0]!.p_next_at, null, "a one-time schedule ends");
});

test("a refusal (e.g. permission removed) is recorded and told, not retried", async () => {
  const fake = fakeAdmin([row()]);
  const notices: { body?: string }[] = [];
  const sweep = await runner.runDueSchedules(fake.admin as never, {
    now: NOW,
    runOccurrence: async () => {
      throw new Refusal("Turn on file access for that computer first.");
    },
    isRefusal: (e) => e instanceof Refusal,
    notify: async (n) => notices.push(n),
  });
  assert.equal(sweep.refused, 1);
  assert.equal(fake.finished[0]!.p_outcome, "Turn on file access for that computer first.");
  assert.match(notices[0]!.body!, /file access/);
});

test("a technical failure is left claimed for an hour, then given up", async () => {
  const fail = async () => {
    throw new Error("network");
  };
  const early = fakeAdmin([row()]);
  const first = await runner.runDueSchedules(early.admin as never, {
    now: NOW,
    runOccurrence: fail,
    isRefusal: () => false,
    notify: async () => undefined,
  });
  assert.equal(first.retrying, 1);
  assert.equal(early.finished.length, 0, "left claimed for the database to offer again");

  const late = fakeAdmin([row()]);
  const second = await runner.runDueSchedules(late.admin as never, {
    now: new Date("2026-11-20T05:00:00.000Z"),
    runOccurrence: fail,
    isRefusal: () => false,
    notify: async () => undefined,
  });
  assert.equal(second.refused, 1);
  assert.equal(late.finished.length, 1);
});
