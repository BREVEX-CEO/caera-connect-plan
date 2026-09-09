import { describe, expect, it, vi } from "vitest";

const store = vi.hoisted(async () => {
  const { createFakePostgrest } = await import("@/lib/__tests__/support/fake-postgrest");
  return createFakePostgrest({ ocade_tasks: {} });
});

vi.mock("@/integrations/supabase/on-demand", () => ({
  loadSupabaseClient: async () => (await store).client,
}));

const db = await store;
const {
  canTransition,
  createUnifiedTask,
  listTasks,
  persistTask,
  removeTask,
  retryTask,
  taskFromAutomationRun,
  transitionTask,
} = await import("../unified-task");

describe("unified task runtime", () => {
  it("allows the normal planning to verification lifecycle", () => {
    const created = createUnifiedTask(
      { source: "research", title: "Research a claim" },
      "2026-08-17T12:00:00.000Z",
    );
    const planning = transitionTask(created, "PLANNING", {}, "2026-08-17T12:00:01.000Z");
    const executing = transitionTask(
      planning,
      "EXECUTING",
      { currentStep: "Open sources" },
      "2026-08-17T12:00:02.000Z",
    );
    const verifying = transitionTask(
      executing,
      "VERIFYING",
      { progress: 90 },
      "2026-08-17T12:00:03.000Z",
    );
    const completed = transitionTask(
      verifying,
      "COMPLETED",
      { progress: 100 },
      "2026-08-17T12:00:04.000Z",
    );
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

/**
 * WHERE TASKS ARE KEPT — PLAN.md Phase 2.
 *
 * They were in IndexedDB with a `localStorage` fallback, so work started on a
 * laptop was invisible on a phone and gone when somebody cleared their browser,
 * while that same person's automation runs were already in the account.
 *
 * The fallback is the part worth naming: on any failure the old store wrote to
 * the other place and returned the task as though it had been saved, so a
 * caller could never tell whether the work it just recorded existed anywhere.
 * These prove the opposite — a failure is a failure, and it is said out loud.
 */
describe("tasks are kept in the account", () => {
  it("writes a task and reads it back", async () => {
    db.reset();
    const task = createUnifiedTask({ source: "work", title: "Prepare the report" });
    const saved = await persistTask(task);
    expect(saved.id).toBe(task.id);

    const [stored] = await listTasks();
    expect(stored!.title).toBe("Prepare the report");
    expect(stored!.status).toBe("CREATED");
  });

  it("round-trips the fields a board actually renders", async () => {
    db.reset();
    const task = transitionTask(
      createUnifiedTask({
        source: "automation",
        sourceRef: "run-1",
        title: "Nightly export",
        request: "Export last week",
        permissionRequirements: ["files.write"],
        dependencyTaskIds: ["other"],
      }),
      "EXECUTING",
      { currentStep: "Writing the file", progress: 0.5 },
    );
    await persistTask(task);

    const [stored] = await listTasks();
    expect(stored).toMatchObject({
      source: "automation",
      sourceRef: "run-1",
      request: "Export last week",
      currentStep: "Writing the file",
      progress: 0.5,
      permissionRequirements: ["files.write"],
      dependencyTaskIds: ["other"],
    });
  });

  it("replaces a task rather than storing it twice", async () => {
    db.reset();
    const task = createUnifiedTask({ source: "code", title: "Fix the build" });
    await persistTask(task);
    await persistTask(transitionTask(task, "EXECUTING"));

    const stored = await listTasks();
    expect(stored).toHaveLength(1);
    expect(stored[0]!.status).toBe("EXECUTING");
  });

  it("gives a task an id the column can hold", async () => {
    // The fallback used to be `task-1738…`, which a uuid column refuses — so a
    // browser without `crypto.randomUUID` could create work that cannot be
    // saved at all.
    expect(createUnifiedTask({ source: "work", title: "x" }).id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("REFUSES rather than pretending, when the account cannot be reached", async () => {
    db.reset();
    db.failNext();
    await expect(
      persistTask(createUnifiedTask({ source: "work", title: "Unsaved" })),
    ).rejects.toThrow(/Failed to fetch/);
  });

  it("refuses to save a task when nobody is signed in", async () => {
    db.reset();
    db.signedInAs(null);
    await expect(
      persistTask(createUnifiedTask({ source: "work", title: "Nobody's" })),
    ).rejects.toThrow(/sign in/i);
    db.signedInAs("user-1");
  });

  it("removes a task", async () => {
    db.reset();
    const task = await persistTask(createUnifiedTask({ source: "work", title: "Temporary" }));
    await removeTask(task.id);
    expect(await listTasks()).toEqual([]);
  });
});
