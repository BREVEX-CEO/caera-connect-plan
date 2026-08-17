import { describe, expect, it } from "vitest";
import {
  canTransition,
  createUnifiedTask,
  retryTask,
  taskFromAutomationRun,
  transitionTask,
} from "../unified-task";

describe("unified task runtime", () => {
  it("allows the normal planning to verification lifecycle", () => {
    const created = createUnifiedTask({ source: "research", title: "Research a claim" }, "2026-08-17T12:00:00.000Z");
    const planning = transitionTask(created, "PLANNING", {}, "2026-08-17T12:00:01.000Z");
    const executing = transitionTask(planning, "EXECUTING", { currentStep: "Open sources" }, "2026-08-17T12:00:02.000Z");
    const verifying = transitionTask(executing, "VERIFYING", { progress: 90 }, "2026-08-17T12:00:03.000Z");
    const completed = transitionTask(verifying, "COMPLETED", { progress: 100 }, "2026-08-17T12:00:04.000Z");
    expect(completed.status).toBe("COMPLETED");
    expect(completed.startedAt).toBe("2026-08-17T12:00:02.000Z");
    expect(completed.finishedAt).toBe("2026-08-17T12:00:04.000Z");
  });

  it("refuses impossible transitions", () => {
    const task = createUnifiedTask({ source: "work", title: "Move a file" });
    expect(canTransition("CREATED", "COMPLETED")).toBe(false);
    expect(() => transitionTask(task, "COMPLETED")).toThrow(/Invalid task transition/);
  });

  it("allows a failed task to retry through planning", () => {
    const created = createUnifiedTask({ source: "code", title: "Run tests" });
    const failed = transitionTask(created, "FAILED", { lastError: "Host unavailable" });
    const retried = retryTask(failed);
    expect(retried.status).toBe("PLANNING");
    expect(retried.retryCount).toBe(1);
    expect(retried.lastError).toBeUndefined();
  });

  it("maps real automation run states into the common vocabulary", () => {
    const task = taskFromAutomationRun(
      {
        id: "run-1",
        automation_id: "automation-1",
        status: "awaiting_approval",
        attempt: 2,
        blocked_reason: "Confirm file change",
        error: null,
        created_at: "2026-08-17T12:00:00.000Z",
        finished_at: null,
      },
      "Nightly cleanup",
    );
    expect(task.status).toBe("WAITING_PERMISSION");
    expect(task.currentStep).toBe("Confirm file change");
    expect(task.retryCount).toBe(1);
  });
});
