/**
 * Deterministic replay (ELITE-02 / VERIFY-05): a verified task run again queues its recorded
 * steps one by one and then the independent check, with no model call; a recorded step that did
 * not apply hands the task back to the planner (the model) instead of carrying on blindly.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { planStep } from "../../src/lib/jarvis/planner.server.ts";
import { intent, type OutcomeCheck } from "../../src/lib/jarvis/contracts.ts";

const checks: OutcomeCheck[] = [
  {
    id: "out",
    description: "the report exists",
    kind: "file_exists",
    params: { path: "OCADE output/r.txt" },
  },
];
const now = new Date("2026-11-21T00:00:00Z");
const later = new Date(now.getTime() + 600_000);
const replay = [
  { operation: "fs.read_text", arguments: { path: "notes.txt" } },
  { operation: "fs.write_text", arguments: { path: "OCADE output/r.txt", text: "done" } },
];
const noModel = async () => {
  throw new Error("the model was asked during a replay");
};
const base = {
  userId: "u",
  objective: "Write the report",
  checks,
  grants: ["files"],
  now,
  replay,
  permitKey: noModel,
};
const done = (key: string, operation: "fs.read_text" | "fs.write_text", args: never) => ({
  intent: intent(operation, key, args, later),
  status: "done",
  controller: null,
  completedAt: now.toISOString(),
  receipt: {
    status: "observed" as const,
    maybeChanged: false,
    observedAtUtc: now.toISOString(),
    evidence: { sha256: "a".repeat(64) },
  },
  resolution: null,
});

test("recorded steps, then the independent check, with no model call", async () => {
  const first = await planStep({ ...base, steps: [] });
  assert.equal(first.kind, "queue");
  assert.equal((first as { intent: { key: string } }).intent.key, "replay-1");
  const second = await planStep({
    ...base,
    steps: [done("replay-1", "fs.read_text", { path: "notes.txt" } as never)] as never,
  });
  assert.equal((second as { intent: { operation: string } }).intent.operation, "fs.write_text");
  const check = await planStep({
    ...base,
    steps: [
      done("replay-1", "fs.read_text", { path: "notes.txt" } as never),
      done("replay-2", "fs.write_text", { path: "OCADE output/r.txt", text: "done" } as never),
    ] as never,
  });
  assert.equal((check as { intent: { operation: string } }).intent.operation, "verify.checks");
});

test("a recorded step that did not apply hands the task back to the planner", async () => {
  const failed = {
    ...done("replay-1", "fs.read_text", { path: "notes.txt" } as never),
    status: "failed",
    receipt: {
      status: "not_applied" as const,
      maybeChanged: false,
      observedAtUtc: now.toISOString(),
      evidence: {},
      errorCode: "not_found",
    },
  };
  await assert.rejects(planStep({ ...base, steps: [failed] as never }), /model was asked/);
});
