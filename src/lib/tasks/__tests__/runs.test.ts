/**
 * What a task control has to actually do.
 *
 * The rule these tests exist to hold is the one the specification states
 * plainly: do not implement fake controls. STOP must end the work, PAUSE must
 * suspend it, RESUME must carry on from where it stopped, and a run that ended
 * for one reason must not later be relabelled with another.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  activeRuns,
  describeRuns,
  elapsedMs,
  finishRun,
  getRun,
  pauseRun,
  project,
  resetRunsForTest,
  resumeRun,
  startRun,
  stopAllRuns,
  stopRun,
  subscribeToRuns,
  updateRun,
} from "../runs";
import { StopTaskError, stopTask } from "@/primary-logic/tasks/stopTask";
import { getPillLabel } from "@/primary-logic/tasks/pillLabel";
import { createTaskRun, generateTaskId } from "@/primary-logic/tasks/lifecycle";
import { isTaskTool, runTaskTool } from "../task-tools";

afterEach(() => {
  resetRunsForTest();
  vi.useRealTimers();
});

describe("stopping a run", () => {
  it("kills the work before it marks the run stopped", async () => {
    const order: string[] = [];
    const run = startRun({
      kind: "mission",
      description: "Tidy the downloads folder",
      kill: () => {
        // If the status had already flipped, a killer that inspected the run
        // would see a finished task and could reasonably decline to act.
        order.push(`killed while ${getRun(run.id)?.status}`);
      },
    });

    const result = await stopRun(run.id);

    expect(order).toEqual(["killed while running"]);
    expect(result.label).toBe("Tidy the downloads folder");
    expect(getRun(run.id)?.status).toBe("killed");
  });

  it("says which of the three things went wrong", async () => {
    await expect(stopRun("nope")).rejects.toMatchObject({ code: "not_found" });

    const finished = startRun({ kind: "shell", description: "ls", kill: () => {} });
    finishRun(finished.id, "completed");
    await expect(stopRun(finished.id)).rejects.toMatchObject({ code: "not_running" });

    // A kind of run with no killer registered is the third case, and it must
    // report itself rather than silently pretending to have stopped.
    const orphan = createTaskRun({ kind: "monitor", description: "watch" });
    await expect(
      stopTask(orphan.id, {
        get: () => ({ ...orphan, status: "running" }),
        kill: () => false,
        markKilled: () => {
          throw new Error("must not mark a run stopped that was never killed");
        },
      }),
    ).rejects.toMatchObject({ code: "unsupported_type" });
  });

  it("does not let a later finish overwrite what the user did", async () => {
    const run = startRun({ kind: "mission", description: "Book a table", kill: () => {} });
    await stopRun(run.id, "You stopped it.");
    finishRun(run.id, "completed");
    expect(getRun(run.id)?.status).toBe("killed");
    expect(getRun(run.id)?.detail).toBe("You stopped it.");
  });

  it("keeps going when one run refuses to stop", async () => {
    startRun({
      kind: "shell",
      description: "stubborn",
      kill: () => {
        throw new Error("no");
      },
    });
    const willing = startRun({ kind: "shell", description: "willing", kill: () => {} });
    const stopped = await stopAllRuns();
    expect(stopped).toBe(1);
    expect(getRun(willing.id)?.status).toBe("killed");
  });
});

describe("pausing", () => {
  it("does not count the time the user was away", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const run = startRun({ kind: "mission", description: "Sort photos", kill: () => {} });

    vi.setSystemTime(new Date("2026-01-01T00:01:00Z"));
    pauseRun(run.id);
    expect(getRun(run.id)?.status).toBe("paused");

    // An hour of being paused.
    vi.setSystemTime(new Date("2026-01-01T01:01:00Z"));
    expect(elapsedMs(getRun(run.id)!)).toBe(60_000);

    resumeRun(run.id);
    vi.setSystemTime(new Date("2026-01-01T01:02:00Z"));
    expect(getRun(run.id)?.status).toBe("running");
    expect(elapsedMs(getRun(run.id)!)).toBe(120_000);
  });

  it("banks an open pause when the run is stopped mid-pause", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const run = startRun({ kind: "mission", description: "Draft a reply", kill: () => {} });
    vi.setSystemTime(new Date("2026-01-01T00:00:30Z"));
    pauseRun(run.id);
    vi.setSystemTime(new Date("2026-01-01T00:10:30Z"));
    await stopRun(run.id);
    expect(elapsedMs(getRun(run.id)!)).toBe(30_000);
  });
});

describe("what the rest of the product sees", () => {
  it("tells subscribers as soon as a run starts", () => {
    const seen: number[] = [];
    const unsubscribe = subscribeToRuns((tasks) => seen.push(tasks.length));
    startRun({ kind: "mission", description: "Anything", kill: () => {} });
    unsubscribe();
    expect(seen).toEqual([0, 1]);
  });

  it("projects a run into a board task without inventing a failure", async () => {
    const run = startRun({ kind: "mission", description: "Rename files", kill: () => {} });
    expect(project(getRun(run.id)!).status).toBe("EXECUTING");
    pauseRun(run.id);
    expect(project(getRun(run.id)!).status).toBe("WAITING_USER");
    await stopRun(run.id);
    // Stopped by the user is cancelled, never failed — the board offers to pick
    // a cancelled task back up, and calling it a failure would be a lie.
    const projected = project(getRun(run.id)!);
    expect(projected.status).toBe("CANCELLED");
    expect(projected.lastError).toBeUndefined();
  });

  it("describes what is running in the user's words", () => {
    startRun({ kind: "shell", description: "npm test", isBackgrounded: true, kill: () => {} });
    startRun({ kind: "shell", description: "npm build", isBackgrounded: true, kill: () => {} });
    expect(describeRuns().label).toBe("2 commands");
    expect(describeRuns().needsAttention).toBe(false);

    const paused = startRun({
      kind: "shell",
      description: "npm lint",
      isBackgrounded: true,
      kill: () => {},
    });
    pauseRun(paused.id);
    expect(describeRuns().needsAttention).toBe(true);
  });

  it("names no engine, model or file in the pill", () => {
    const label = getPillLabel([
      createTaskRun({ kind: "mission", description: "Anything" }),
      createTaskRun({ kind: "shell", description: "Anything else" }),
    ]);
    expect(label).toBe("2 tasks running");
    expect(label).not.toMatch(/qwen|webgpu|wasm|gguf|\.bin/i);
  });

  it("counts only what is still live as active", () => {
    const a = startRun({ kind: "mission", description: "one", kill: () => {} });
    startRun({ kind: "mission", description: "two", kill: () => {} });
    finishRun(a.id, "completed");
    expect(activeRuns()).toHaveLength(1);
  });

  it("refuses to change a run that has already ended", () => {
    const run = startRun({ kind: "mission", description: "one", kill: () => {} });
    finishRun(run.id, "failed", "The engine stopped.");
    updateRun(run.id, { description: "rewritten" });
    expect(getRun(run.id)?.description).toBe("one");
  });
});

describe("task ids", () => {
  it("are prefixed by kind and long enough not to collide", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 500; i++) ids.add(generateTaskId("shell"));
    expect(ids.size).toBe(500);
    expect([...ids].every((id) => id.startsWith("b") && id.length === 9)).toBe(true);
  });
});

describe("the task tools", () => {
  it("answers what is running with no companion attached", async () => {
    startRun({ kind: "mission", description: "Clear the inbox", kill: () => {} });
    const outcome = await runTaskTool("task_list", {});
    expect(outcome.kind).toBe("success");
    expect(outcome.detail).toBe("1 task is running.");
  });

  it("really stops the run it names", async () => {
    let killed = false;
    const run = startRun({
      kind: "mission",
      description: "Rename the folder",
      kill: () => {
        killed = true;
      },
    });
    const outcome = await runTaskTool("task_stop", { id: run.id });
    expect(killed).toBe(true);
    expect(outcome.kind).toBe("success");
    expect(outcome.verified).toBe(true);
  });

  it("turns each stop failure into its own sentence", async () => {
    expect((await runTaskTool("task_stop", {})).kind).toBe("blocked");
    expect((await runTaskTool("task_stop", { id: "missing" })).detail).toBe(
      "There is no task with that id.",
    );
    const run = startRun({ kind: "mission", description: "done", kill: () => {} });
    finishRun(run.id, "completed");
    const already = await runTaskTool("task_stop", { id: run.id });
    expect(already.kind).toBe("state_changed");
    expect(already.detail).toBe("That task had already finished.");
  });

  it("will not write down a task with no title", async () => {
    expect((await runTaskTool("task_create", { title: "   " })).kind).toBe("blocked");
  });

  it("knows which names it owns", () => {
    expect(isTaskTool("task_stop")).toBe(true);
    expect(isTaskTool("screen_click")).toBe(false);
  });
});

describe("StopTaskError", () => {
  it("carries a code a caller can branch on", () => {
    const error = new StopTaskError("gone", "not_found");
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("not_found");
  });
});
