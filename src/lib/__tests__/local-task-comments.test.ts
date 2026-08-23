import { beforeEach, describe, expect, it } from "vitest";
import {
  createTaskComment,
  deleteTaskComment,
  editTaskComment,
  listTaskComments,
  mentionsInComment,
  setTaskCommentArchived,
  setTaskCommentResolved,
  toggleTaskCommentReaction,
} from "@/lib/comments/local-task-comments";

const memory = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value) },
});

describe("local task comments", () => {
  beforeEach(() => memory.clear());

  it("anchors threads, mentions, reactions, edits and resolution to one task", () => {
    const root = createTaskComment({ taskId: "task-1", body: "Ask @OCADE to verify" }, "2026-08-23T18:00:00Z", "c1");
    createTaskComment({ taskId: "task-1", parentId: root.id, body: "Reply" }, "2026-08-23T18:01:00Z", "c2");
    createTaskComment({ taskId: "task-2", body: "Separate" }, "2026-08-23T18:02:00Z", "c3");
    expect(listTaskComments("task-1")).toHaveLength(2);
    expect(mentionsInComment(root.body)).toEqual(["@OCADE"]);
    expect(toggleTaskCommentReaction(root.id, "2026-08-23T18:03:00Z").reacted).toBe(true);
    expect(setTaskCommentResolved(root.id, true, "2026-08-23T18:04:00Z").resolvedAt).toBeTruthy();
    expect(editTaskComment("c2", "Edited reply", "2026-08-23T18:05:00Z").body).toBe("Edited reply");
  });

  it("archives, restores and deletes without an external write", () => {
    createTaskComment({ taskId: "task-1", body: "Archive me" }, "2026-08-23T18:00:00Z", "c1");
    setTaskCommentArchived("c1", true, "2026-08-23T18:01:00Z");
    expect(listTaskComments("task-1")).toEqual([]);
    expect(listTaskComments("task-1", true)).toHaveLength(1);
    expect(deleteTaskComment("c1")).toBe(true);
    expect(listTaskComments("task-1", true)).toEqual([]);
  });
});
