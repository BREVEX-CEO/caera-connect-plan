import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * COMMENTS ON A TASK, IN THE ACCOUNT.
 *
 * These lived in `localStorage`, and every comment was authored by "You on this
 * device" — a byline that existed only because the store could not say where
 * the comment would be readable. `PLAN.md` Phase 2 makes a comment a row
 * against the task it is about, so what is worth proving changed: threads still
 * anchor, and now a reply cannot outlive its parent and nothing is reported as
 * saved that was not.
 */

const store = vi.hoisted(async () => {
  const { createFakePostgrest } = await import("./support/fake-postgrest");
  return createFakePostgrest({
    ocade_tasks: {},
    ocade_task_comments: {
      defaults: { parent_id: null, resolved_at: null, archived_at: null, reacted: false },
      references: [
        { column: "task_id", table: "ocade_tasks", onDelete: "cascade" },
        { column: "parent_id", table: "ocade_task_comments", onDelete: "cascade" },
      ],
    },
  });
});

vi.mock("@/integrations/supabase/on-demand", () => ({
  loadSupabaseClient: async () => (await store).client,
}));

const db = await store;
const {
  createTaskComment,
  deleteTaskComment,
  editTaskComment,
  listTaskComments,
  mentionsInComment,
  setTaskCommentArchived,
  setTaskCommentResolved,
  toggleTaskCommentReaction,
} = await import("@/lib/comments/task-comments");

const TASK = "task-1";
const OTHER = "task-2";

beforeEach(() => {
  db.reset();
  db.seed("ocade_tasks", [
    { id: TASK, user_id: "user-1", title: "First" },
    { id: OTHER, user_id: "user-1", title: "Second" },
  ]);
});

describe("threads are anchored to one task", () => {
  it("keeps replies with their root and other tasks out of it", async () => {
    const root = await createTaskComment({ taskId: TASK, body: "Ask @OCADE to verify" });
    await createTaskComment({ taskId: TASK, parentId: root.id, body: "Reply" });
    await createTaskComment({ taskId: OTHER, body: "Separate" });

    const thread = await listTaskComments(TASK);
    expect(thread).toHaveLength(2);
    expect(thread[1]!.parentId).toBe(root.id);
    expect(await listTaskComments(OTHER)).toHaveLength(1);
  });

  it("reads a thread oldest first, which is the order it was written in", async () => {
    await createTaskComment({ taskId: TASK, body: "first" });
    await createTaskComment({ taskId: TASK, body: "second" });
    expect((await listTaskComments(TASK)).map((comment) => comment.body)).toEqual([
      "first",
      "second",
    ]);
  });

  it("finds the mentions in a body", () => {
    expect(mentionsInComment("Ask @OCADE and @sam, not @OCADE again")).toEqual(["@OCADE", "@sam"]);
  });
});

describe("what it refuses", () => {
  it("refuses an empty comment rather than storing a blank row", async () => {
    await expect(createTaskComment({ taskId: TASK, body: "   " })).rejects.toThrow(
      /Write a comment/i,
    );
    expect(db.rowsIn("ocade_task_comments")).toHaveLength(0);
  });

  it("refuses a comment with no task to anchor it to", async () => {
    await expect(createTaskComment({ taskId: "  ", body: "x" })).rejects.toThrow(/task anchor/i);
  });

  it("reports a reply to something that is gone as exactly that", async () => {
    await expect(
      createTaskComment({ taskId: TASK, parentId: "no-such-comment", body: "x" }),
    ).rejects.toThrow(/no longer available/i);
  });

  it("refuses when nobody is signed in", async () => {
    db.signedInAs(null);
    await expect(createTaskComment({ taskId: TASK, body: "x" })).rejects.toThrow(/sign in/i);
  });

  it("refuses to edit a comment into nothing", async () => {
    const comment = await createTaskComment({ taskId: TASK, body: "real" });
    await expect(editTaskComment(comment.id, "  ")).rejects.toThrow(/cannot be empty/i);
  });

  it("says so when the comment being changed is gone", async () => {
    await expect(editTaskComment("no-such-comment", "x")).rejects.toThrow(/no longer exists/i);
    await expect(toggleTaskCommentReaction("no-such-comment")).rejects.toThrow(/no longer exists/i);
  });
});

describe("resolving, acknowledging and archiving", () => {
  it("records a resolution and reopens it", async () => {
    const comment = await createTaskComment({ taskId: TASK, body: "Question" });
    expect((await setTaskCommentResolved(comment.id, true)).resolvedAt).toBeTruthy();
    expect((await setTaskCommentResolved(comment.id, false)).resolvedAt).toBeNull();
  });

  it("toggles an acknowledgement from whatever is stored", async () => {
    const comment = await createTaskComment({ taskId: TASK, body: "Noted" });
    expect((await toggleTaskCommentReaction(comment.id)).reacted).toBe(true);
    expect((await toggleTaskCommentReaction(comment.id)).reacted).toBe(false);
  });

  it("hides an archived comment but does not delete it", async () => {
    /*
     * Archiving is somebody saying "not in my way", not "delete this". A
     * screen that could never show it again would make the distinction
     * meaningless — so it is excluded by default and asked for explicitly.
     */
    const comment = await createTaskComment({ taskId: TASK, body: "Archive me" });
    await setTaskCommentArchived(comment.id, true);
    expect(await listTaskComments(TASK)).toEqual([]);
    expect(await listTaskComments(TASK, true)).toHaveLength(1);

    await setTaskCommentArchived(comment.id, false);
    expect(await listTaskComments(TASK)).toHaveLength(1);
  });
});

describe("deletion takes what depended on it", () => {
  it("removes a comment and reports whether it was there", async () => {
    const comment = await createTaskComment({ taskId: TASK, body: "Bye" });
    expect(await deleteTaskComment(comment.id)).toBe(true);
    expect(await deleteTaskComment(comment.id)).toBe(false);
  });

  it("takes REPLIES with the comment they answer", async () => {
    // An orphaned reply reads as an answer to a question nobody can see.
    const root = await createTaskComment({ taskId: TASK, body: "Question" });
    await createTaskComment({ taskId: TASK, parentId: root.id, body: "Answer" });
    await deleteTaskComment(root.id);
    expect(await listTaskComments(TASK, true)).toEqual([]);
  });
});

describe("an unreachable account is never reported as saved", () => {
  it("throws rather than returning a comment that does not exist", async () => {
    db.failNext();
    await expect(createTaskComment({ taskId: TASK, body: "x" })).rejects.toThrow(/Failed to fetch/);
  });

  it("throws on a read, so the screen can say the list may be out of date", async () => {
    await createTaskComment({ taskId: TASK, body: "x" });
    db.failNext();
    await expect(listTaskComments(TASK)).rejects.toThrow(/Failed to fetch/);
  });
});
