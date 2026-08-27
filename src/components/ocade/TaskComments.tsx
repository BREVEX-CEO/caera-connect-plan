import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  createTaskComment,
  deleteTaskComment,
  editTaskComment,
  listTaskComments,
  mentionsInComment,
  setTaskCommentArchived,
  setTaskCommentResolved,
  toggleTaskCommentReaction,
  type LocalTaskComment,
} from "@/lib/comments/local-task-comments";

export function TaskComments({ taskId }: { taskId: string }) {
  const [comments, setComments] = useState<LocalTaskComment[]>([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  /*
   * Stable across renders, so the effect below can depend on it honestly.
   *
   * As a plain function it was a new value every render, and the effect
   * suppressed it by listing its inputs instead — which works until somebody
   * adds a third input and the list quietly stops matching what the function
   * actually reads.
   */
  const refresh = useCallback(
    (archived = showArchived) => {
      setComments(listTaskComments(taskId, archived));
    },
    [taskId, showArchived],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  function submit() {
    try {
      if (editing) editTaskComment(editing, draft);
      else createTaskComment({ taskId, body: draft, parentId: replyTo });
      setDraft("");
      setReplyTo(null);
      setEditing(null);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the comment.");
    }
  }

  const roots = comments.filter(
    (comment) =>
      !comment.parentId || !comments.some((candidate) => candidate.id === comment.parentId),
  );
  const replies = (id: string) => comments.filter((comment) => comment.parentId === id);

  function actions(comment: LocalTaskComment) {
    return (
      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
        <button
          type="button"
          onClick={() => {
            setReplyTo(comment.id);
            setEditing(null);
            setDraft("");
          }}
          className="underline"
        >
          Reply
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(comment.id);
            setReplyTo(null);
            setDraft(comment.body);
          }}
          className="underline"
        >
          Edit
        </button>
        <button
          type="button"
          aria-pressed={comment.reacted}
          onClick={() => {
            toggleTaskCommentReaction(comment.id);
            refresh();
          }}
          className="underline"
        >
          {comment.reacted ? "Remove acknowledgement" : "Acknowledge"}
        </button>
        <button
          type="button"
          onClick={() => {
            setTaskCommentResolved(comment.id, !comment.resolvedAt);
            refresh();
          }}
          className="underline"
        >
          {comment.resolvedAt ? "Reopen" : "Resolve"}
        </button>
        <button
          type="button"
          onClick={() => {
            setTaskCommentArchived(comment.id, !comment.archivedAt);
            refresh();
          }}
          className="underline"
        >
          {comment.archivedAt ? "Restore" : "Archive"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Delete this on-device comment?")) {
              deleteTaskComment(comment.id);
              refresh();
            }
          }}
          className="underline text-destructive"
        >
          Delete
        </button>
      </div>
    );
  }

  function commentCard(comment: LocalTaskComment, nested = false) {
    const mentions = mentionsInComment(comment.body);
    return (
      <article
        key={comment.id}
        className={`${nested ? "ml-5" : ""} rounded-lg border border-border/50 p-3`}
      >
        <div className="flex flex-wrap justify-between gap-2 text-[11px] text-muted-foreground">
          <span>
            {comment.author}
            {comment.resolvedAt ? " · resolved" : ""}
            {comment.archivedAt ? " · archived" : ""}
          </span>
          <time dateTime={comment.updatedAt}>{new Date(comment.updatedAt).toLocaleString()}</time>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm">{comment.body}</p>
        {mentions.length ? (
          <p aria-label="Mentions" className="mt-1 text-[11px] text-primary">
            Mentions: {mentions.join(", ")}
          </p>
        ) : null}
        {actions(comment)}
      </article>
    );
  }

  return (
    <section aria-labelledby="task-comments-title" className="border-t border-border/50 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 id="task-comments-title" className="text-sm font-medium">
          Comments <span aria-label={`${comments.length} comments`}>({comments.length})</span>
        </h3>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          Show archived
        </label>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Anchored to this task and stored only on this device. No teammate is notified.
      </p>
      <div className="mt-3 space-y-2">
        {roots.map((root) => (
          <div key={root.id} className="space-y-2">
            {commentCard(root)}
            {replies(root.id).map((reply) => commentCard(reply, true))}
          </div>
        ))}
        {!comments.length ? (
          <p className="rounded-lg border border-dashed border-border/50 p-3 text-xs text-muted-foreground">
            No comments on this task.
          </p>
        ) : null}
      </div>
      <div className="mt-3">
        {editing || replyTo ? (
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{editing ? "Editing comment" : "Replying in thread"}</span>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setReplyTo(null);
                setDraft("");
              }}
              className="underline"
            >
              Cancel
            </button>
          </div>
        ) : null}
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            onClick={() =>
              setDraft((value) => `${value}${value && !value.endsWith(" ") ? " " : ""}@OCADE `)
            }
            className="min-h-8 rounded-md border border-border/60 px-2 text-xs"
          >
            Mention OCADE
          </button>
        </div>
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="Task comment"
          placeholder="Add an on-device comment"
          rows={3}
        />
        <Button type="button" className="mt-2" disabled={!draft.trim()} onClick={submit}>
          {editing ? "Save edit" : replyTo ? "Post reply" : "Post comment"}
        </Button>
      </div>
    </section>
  );
}
