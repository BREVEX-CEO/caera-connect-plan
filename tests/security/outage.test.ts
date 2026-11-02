/** A computer that stopped answering is shown as unreachable, never as silently busy. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { taskView, type Admin } from "../../src/lib/jarvis/authority.server.ts";

test("a running task says plainly when its computer is unreachable", async () => {
  const now = new Date("2026-11-02T12:00:00.000Z");
  const state = (status: string, seenSecondsAgo: number | null) => ({
    id: "t",
    userId: "u",
    status,
    controller: null,
    title: "Synthetic task",
    outcome: null,
    blocker: null,
    result: null,
    checkpoint: null,
    conversationId: "c",
    deviceName: "Synthetic PC",
    deviceSeenAt:
      seenSecondsAgo === null
        ? null
        : new Date(now.getTime() - seenSecondsAgo * 1000).toISOString(),
    grants: ["files"],
    mcp: [],
    engines: null,
    timing: {
      acceptedAt: new Date(now.getTime() - 600_000).toISOString(),
      finishedAt: null,
      now: now.toISOString(),
      pausedMs: 0,
      modelCalls: 0,
      modelMs: 0,
    },
    steps: [],
  });
  const view = async (status: string, seen: number | null) =>
    taskView(
      { rpc: async () => ({ data: state(status, seen), error: null }) } as unknown as Admin,
      "u",
      "t",
    );
  assert.equal((await view("running", 10)).deviceOffline, false, "recent contact");
  assert.equal((await view("running", 300)).deviceOffline, true, "five minutes of silence");
  assert.equal((await view("running", null)).deviceOffline, true, "never seen");
  assert.equal(
    (await view("waiting", 300)).deviceOffline,
    false,
    "only a running task waits on it",
  );
});
