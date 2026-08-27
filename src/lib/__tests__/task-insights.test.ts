import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createUnifiedTask, transitionTask } from "@/lib/tasks/unified-task";
import { scheduleTask, taskAnalytics, timelineDays } from "@/lib/tasks/task-insights";

describe("task analytics and timeline", () => {
  it("calculates range metrics, period comparison, statuses and source segments", () => {
    const recent = createUnifiedTask({ title: "Recent", source: "work" }, "2026-08-23T10:00:00Z");
    const started = transitionTask(
      createUnifiedTask({ title: "Done", source: "research" }, "2026-08-22T10:00:00Z"),
      "EXECUTING",
      {},
      "2026-08-22T11:00:00Z",
    );
    const verifying = transitionTask(started, "VERIFYING", {}, "2026-08-23T10:30:00Z");
    const done = transitionTask(verifying, "COMPLETED", {}, "2026-08-23T11:00:00Z");
    const prior = createUnifiedTask({ title: "Prior", source: "work" }, "2026-08-01T10:00:00Z");
    const data = taskAnalytics([recent, done, prior], "7", new Date("2026-08-24T00:00:00Z"));
    expect(data).toMatchObject({
      total: 2,
      completed: 1,
      completionRate: 50,
      priorTotal: 0,
      difference: 2,
    });
    expect(data.bySource.map((item) => item.source)).toEqual(["research", "work"]);
  });

  it("builds a date axis and reschedules a persisted task without changing its outcome", () => {
    const task = createUnifiedTask({ title: "Release", source: "work" }, "2026-08-23T10:00:00Z");
    const days = timelineDays(new Date("2026-08-24T12:00:00Z"));
    expect(days).toHaveLength(7);
    const moved = scheduleTask(task, days[4], "2026-08-24T12:01:00Z");
    expect(moved.status).toBe("CREATED");
    expect(new Date(moved.scheduledFor!).toDateString()).toBe(days[4].toDateString());
  });

  it("wires detail, analytics and Gantt interactions into the task workspace", () => {
    const board = readFileSync("src/components/ocade/TaskBoard.tsx", "utf8");
    const analytics = readFileSync("src/components/ocade/TaskAnalytics.tsx", "utf8");
    const timeline = readFileSync("src/components/ocade/TaskTimeline.tsx", "utf8");
    for (const value of ["Edit title", "Delete task", "Task board /", "TaskComments"])
      expect(board).toContain(value);
    for (const value of [
      "Date range",
      "Completion rate",
      "Tasks by status",
      "Segment breakdown",
      "Last updated",
    ])
      expect(analytics).toContain(value);
    for (const value of ["Today", "Depends on", "Drag a task bar", "Reschedule", "Work area"])
      expect(timeline).toContain(value);
  });
});
