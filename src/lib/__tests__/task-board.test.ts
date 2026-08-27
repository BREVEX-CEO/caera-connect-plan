import { describe, expect, it } from "vitest";
import { createUnifiedTask, transitionTask, type UnifiedTask } from "@/lib/tasks/unified-task";
import {
  filterAndSortTasks,
  moveTaskToColumn,
  paginateTaskFeed,
  taskBoardColumn,
  taskFeedAuthor,
  taskSourceGroups,
} from "@/lib/tasks/task-board";

const AT = "2026-08-23T18:00:00.000Z";

function task(title: string, source: UnifiedTask["source"] = "work") {
  return createUnifiedTask({ title, source, request: `${title} request` }, AT);
}

describe("OCADE task board", () => {
  it("maps and moves real unified tasks without claiming cancelled work completed", () => {
    const queued = task("Prepare release");
    const active = moveTaskToColumn(queued, "active", "2026-08-23T18:01:00.000Z");
    expect(active.status).toBe("EXECUTING");
    expect(taskBoardColumn(active)).toBe("active");
    const waiting = moveTaskToColumn(active, "waiting", "2026-08-23T18:02:00.000Z");
    expect(waiting.status).toBe("WAITING_USER");
    const closed = moveTaskToColumn(waiting, "closed", "2026-08-23T18:03:00.000Z");
    expect(closed.status).toBe("CANCELLED");
    expect(taskBoardColumn(closed)).toBe("closed");
  });

  it("supports filtering, sorting, source grouping and safe retry", () => {
    const work = task("Write proof");
    const research = task("Read policy", "research");
    const failed = transitionTask(research, "FAILED", { lastError: "offline" }, AT);
    expect(filterAndSortTasks([work, failed], "policy", "all", "title")).toEqual([failed]);
    expect(taskSourceGroups([work, failed]).map(([source]) => source)).toEqual([
      "research",
      "work",
    ]);
    expect(moveTaskToColumn(failed, "queued", "2026-08-23T18:04:00.000Z").status).toBe("PLANNING");
    expect(taskFeedAuthor(work)).toBe("You on this device");
    expect(taskFeedAuthor({ ...failed, agent: "OCADE Research" })).toBe("OCADE Research");
    expect(paginateTaskFeed([work, failed], 2, 1)).toMatchObject({
      page: 2,
      pages: 2,
      items: [failed],
    });
  });
});
