/**
 * What a reload is allowed to conclude about work it cannot see.
 *
 * The registry of live runs is per-tab: nothing in it survives a refresh, a
 * crash or a second window. Recovery therefore rests entirely on one judgement
 * — "this row says EXECUTING and I am not running it, so it must be dead" —
 * and that judgement was wrong in the one case that matters most: another tab,
 * running the mission perfectly well, on the same account.
 *
 * These tests hold both halves of it. A page that is gone must be reported as
 * interrupted, and a page that is still working must not be.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

const stored = new Map<string, UnifiedTask>();

vi.mock("@/lib/tasks/unified-task", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tasks/unified-task")>(
    "@/lib/tasks/unified-task",
  );
  return {
    ...actual,
    listTasks: async () => [...stored.values()],
    persistTask: async (task: UnifiedTask) => {
      stored.set(task.id, task);
      return task;
    },
  };
});

import type { UnifiedTask } from "@/lib/tasks/unified-task";
import {
  HEARTBEAT_MS,
  INTERRUPTED_AFTER_MS,
  reconcileInterruptedRuns,
  resetRunsForTest,
  startRun,
} from "../runs";

afterEach(() => {
  resetRunsForTest();
  stored.clear();
  vi.useRealTimers();
});

/** A row the account holds, as some other page left it. */
function leftBehind(id: string, agoMs: number, status: UnifiedTask["status"] = "EXECUTING") {
  const at = new Date(Date.now() - agoMs).toISOString();
  stored.set(id, {
    id,
    source: "work",
    title: "Tidy the downloads folder",
    status,
    retryCount: 0,
    createdAt: at,
    updatedAt: at,
    startedAt: at,
  });
}

describe("recovering from a reload or a crash", () => {
  it("reports work whose page is gone as interrupted", async () => {
    leftBehind("dead", INTERRUPTED_AFTER_MS + 1_000);

    const repaired = await reconcileInterruptedRuns();

    expect(repaired.map((task) => task.id)).toEqual(["dead"]);
    expect(stored.get("dead")?.status).toBe("FAILED");
    // Said in words a person can act on, because RESUME is the next thing they
    // will look for.
    expect(stored.get("dead")?.lastError).toMatch(/interrupted/i);
  });

  it("leaves a mission another tab is still running alone", async () => {
    /*
     * THE DEFECT THIS EXISTS FOR. "Not in my registry" was the whole test, so
     * opening a second tab marked the first tab's live mission FAILED in the
     * account while it carried on moving the mouse. A live run heartbeats, so
     * a recent row means somebody is still working.
     */
    leftBehind("elsewhere", HEARTBEAT_MS - 1_000);

    const repaired = await reconcileInterruptedRuns();

    expect(repaired).toEqual([]);
    expect(stored.get("elsewhere")?.status).toBe("EXECUTING");
  });

  it("leaves a run this page is running alone, however long it has taken", async () => {
    const run = startRun({ kind: "mission", description: "Long one", kill: () => {} });
    leftBehind(run.id, INTERRUPTED_AFTER_MS * 10);

    const repaired = await reconcileInterruptedRuns();

    expect(repaired).toEqual([]);
    expect(stored.get(run.id)?.status).toBe("EXECUTING");
  });

  it("keeps a live run's row warm, so another page does not bury it", async () => {
    vi.useFakeTimers();
    const run = startRun({ kind: "mission", description: "Still going", kill: () => {} });
    // The projection written at start.
    await vi.advanceTimersByTimeAsync(0);
    const first = stored.get(run.id)?.updatedAt;
    expect(first).toBeDefined();

    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS + 100);

    const second = stored.get(run.id)?.updatedAt;
    expect(second).toBeDefined();
    expect(Date.parse(second!)).toBeGreaterThan(Date.parse(first!));
  });

  it("stops beating once nothing is running", async () => {
    vi.useFakeTimers();
    const run = startRun({ kind: "mission", description: "Short one", kill: () => {} });
    await vi.advanceTimersByTimeAsync(0);
    resetRunsForTest();
    stored.clear();

    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 3);

    // Nothing was rewritten, because an idle tab must not keep writing to the
    // account — and because a finished run has to be allowed to go stale.
    expect(stored.has(run.id)).toBe(false);
  });
});
