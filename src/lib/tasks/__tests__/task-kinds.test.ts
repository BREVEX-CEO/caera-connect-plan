import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createUnifiedTask, toRow, toTask, type TaskRow } from "@/lib/tasks/unified-task";

/**
 * The kinds of task a person can create, and the two that were being lost.
 *
 * `docs/APP_FLOW.md`: a task can be immediate, scheduled, recurring,
 * monitoring-style, action-required or remote Dispatch work, and "the creation
 * flow captures only the information required for the chosen task type". Quick
 * add recorded every one of them as immediate work, so a task meant for Friday
 * sat in Queued looking overdue from the moment it was written down, and one
 * that needed somebody's answer looked like something OCADE was about to start.
 */

const BOARD = readFileSync("src/components/ocade/TaskBoard.tsx", "utf8");

describe("a task remembers when it is for", () => {
  it("carries a schedule through the row and back unchanged", () => {
    const at = "2026-09-18T08:00:00.000Z";
    const task = createUnifiedTask({ source: "work", title: "Send the invoice", scheduledFor: at });
    const round = toTask(toRow(task, "00000000-0000-4000-8000-000000000001") as unknown as TaskRow);
    expect(round.scheduledFor).toBe(at);
  });

  it("keeps an unscheduled task unscheduled rather than inventing a time", () => {
    const task = createUnifiedTask({ source: "work", title: "Tidy the desk" });
    const round = toTask(toRow(task, "00000000-0000-4000-8000-000000000001") as unknown as TaskRow);
    expect(round.scheduledFor).toBeUndefined();
  });
});

describe("what the board asks for, and what it then shows", () => {
  it("asks which kind of task this is", () => {
    expect(BOARD).toContain('aria-label="Task type"');
    expect(BOARD).toContain('value="scheduled"');
    expect(BOARD).toContain('value="action"');
  });

  it("asks for a time only when the task is scheduled", () => {
    // "The creation flow captures only the information required for the chosen
    // task type" — the date field does not exist for an immediate task.
    expect(BOARD).toContain('{kind === "scheduled" ? (');
    expect(BOARD).toContain('type="datetime-local"');
  });

  it("refuses a scheduled task with no time instead of quietly filing it as immediate", () => {
    expect(BOARD).toContain('if (kind === "scheduled" && !when)');
  });

  it("stores the schedule as an instant, not as the wall clock somebody typed", () => {
    // The board is read on other devices in other zones; a wall-clock string
    // would mean a different moment on each of them.
    expect(BOARD).toContain("new Date(when).toISOString()");
  });

  it("starts an action-required task waiting rather than queued", () => {
    // Queued means "ready to start". Nothing here is ready until a person
    // answers, and the column is the only thing most people read.
    expect(BOARD).toContain('status: "WAITING_USER" as const');
  });

  it("shows the schedule on the card, where the person is looking", () => {
    // Through the locale authority since Phase 18: the same sentence, in the
    // reader's own date order rather than the browser's.
    expect(BOARD).toContain("Scheduled for {formatters.dateTime(task.scheduledFor)}");
  });
});

describe("a task can be filed with the work it belongs to", () => {
  const PROJECTS = readFileSync("src/routes/_authenticated/ocade.projects.tsx", "utf8");

  it("carries the project through the row and back", () => {
    const project = "00000000-0000-4000-8000-0000000000aa";
    const task = createUnifiedTask({
      source: "work",
      title: "Draft the brief",
      projectId: project,
    });
    const round = toTask(toRow(task, "00000000-0000-4000-8000-000000000001") as unknown as TaskRow);
    expect(round.projectId).toBe(project);
  });

  it("reads back unfiled as unfiled rather than as an empty string", () => {
    const task = createUnifiedTask({ source: "work", title: "Anything" });
    const round = toTask(toRow(task, "00000000-0000-4000-8000-000000000001") as unknown as TaskRow);
    expect(round.projectId).toBeUndefined();
  });

  it("asks for the project column when it reads tasks", () => {
    // A column that is written and never selected reads back as unfiled, which
    // is the same defect as not storing it.
    const unified = readFileSync("src/lib/tasks/unified-task.ts", "utf8");
    const columns = unified.slice(unified.indexOf("const TASK_COLUMNS"));
    expect(columns.slice(0, 400)).toContain("project_id");
  });

  it("offers the filing on the board and shows the result in the project", () => {
    expect(BOARD).toContain('aria-label="Project"');
    expect(BOARD).toContain("fileUnder(selected");
    expect(PROJECTS).toContain("task.projectId === selected.id");
  });
});
