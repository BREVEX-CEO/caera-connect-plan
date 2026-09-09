/**
 * COMMENTS ON A TASK, IN THE ACCOUNT.
 *
 * These lived in `localStorage`, and the interface admitted it: every comment
 * was authored by "You on this device" — a byline that exists only because the
 * store could not say where the comment would be readable. It was invisible on
 * a second device, gone when somebody cleared their browser, and outside every
 * export and deletion path the account offers.
 *
 * `PLAN.md` Phase 2 leaves one persistent authority, so a comment is a row
 * against the task it is about. A reply names its parent, and both go when the
 * task goes — an orphaned reply reads as an answer to a question nobody can
 * see.
 *
 * EVERY FUNCTION HERE THROWS ON FAILURE rather than returning something
 * plausible. A comment somebody typed and pressed send on must either exist or
 * be reported as not existing; a screen that renders it either way is how a
 * person believes they have said something they have not.
 */
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { readAllPages } from "@/lib/supabase/read-all";

export interface TaskComment {
  id: string;
  taskId: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  archivedAt: string | null;
  reacted: boolean;
}

const COLUMNS =
  "id, task_id, parent_id, body, created_at, updated_at, resolved_at, archived_at, reacted";

interface CommentRow {
  id: string;
  task_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  archived_at: string | null;
  reacted: boolean;
}

function toComment(row: CommentRow): TaskComment {
  return {
    id: row.id,
    taskId: row.task_id,
    parentId: row.parent_id,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    archivedAt: row.archived_at,
    reacted: row.reacted,
  };
}

/**
 * One task's thread, oldest first.
 *
 * Archived comments are excluded by default and asked for explicitly, because
 * archiving is somebody saying "not in my way" rather than "delete this" — and
 * a screen that could never show them again would make the distinction
 * meaningless.
 */
export async function listTaskComments(
  taskId: string,
  includeArchived = false,
): Promise<TaskComment[]> {
  const supabase = await loadSupabaseClient();
  /*
   * Paged, because a thread has to be COMPLETE to be correct. PostgREST caps a
   * response at a thousand rows and says nothing about it, so an unpaged read
   * would silently drop the beginning of a long discussion — and a reply whose
   * parent was cut renders as a root comment answering nothing.
   */
  const rows = await readAllPages<CommentRow>((from, to) => {
    const query = supabase
      .from("ocade_task_comments")
      .select(COLUMNS)
      .eq("task_id", taskId)
      .order("created_at", { ascending: true })
      .range(from, to);
    return includeArchived ? query : query.is("archived_at", null);
  });
  return rows.map(toComment);
}

export async function createTaskComment(input: {
  taskId: string;
  body: string;
  parentId?: string | null;
}): Promise<TaskComment> {
  const body = input.body.trim();
  if (!input.taskId.trim()) throw new Error("A comment needs a task anchor.");
  if (!body) throw new Error("Write a comment before posting.");

  const supabase = await loadSupabaseClient();
  const { data: session } = await supabase.auth.getUser();
  const userId = session.user?.id;
  if (!userId) throw new Error("Sign in before commenting.");

  const { data, error } = await supabase
    .from("ocade_task_comments")
    .insert({
      user_id: userId,
      task_id: input.taskId,
      parent_id: input.parentId ?? null,
      body,
    })
    .select(COLUMNS)
    .single();
  if (error) {
    /*
     * 23503 is a foreign key: either the task or the comment being replied to
     * is gone. Both are the same thing from the reader's side — what they were
     * answering is no longer there — and neither should be reported as a
     * database error.
     */
    if (error.code === "23503") throw new Error("That reply target is no longer available.");
    throw new Error(error.message);
  }
  return toComment(data as CommentRow);
}

async function patch(id: string, changes: Partial<CommentRow>): Promise<TaskComment> {
  const supabase = await loadSupabaseClient();
  const { data, error } = await supabase
    .from("ocade_task_comments")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That comment no longer exists.");
  return toComment(data as CommentRow);
}

export function editTaskComment(id: string, body: string): Promise<TaskComment> {
  const clean = body.trim();
  if (!clean) return Promise.reject(new Error("A comment cannot be empty."));
  return patch(id, { body: clean });
}

export function setTaskCommentResolved(id: string, resolved: boolean): Promise<TaskComment> {
  return patch(id, { resolved_at: resolved ? new Date().toISOString() : null });
}

export function setTaskCommentArchived(id: string, archived: boolean): Promise<TaskComment> {
  return patch(id, { archived_at: archived ? new Date().toISOString() : null });
}

/**
 * Toggle the reaction.
 *
 * Read then written, because the value is a flip of what is stored rather than
 * a value the caller supplies. The read is scoped by the same policy as the
 * write, so a comment that is not the reader's is "no longer exists" here as
 * everywhere else.
 */
export async function toggleTaskCommentReaction(id: string): Promise<TaskComment> {
  const supabase = await loadSupabaseClient();
  const { data: current, error } = await supabase
    .from("ocade_task_comments")
    .select("reacted")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!current) throw new Error("That comment no longer exists.");
  return patch(id, { reacted: !(current as { reacted: boolean }).reacted });
}

/** Remove a comment. Its replies go with it, through the foreign key. */
export async function deleteTaskComment(id: string): Promise<boolean> {
  const supabase = await loadSupabaseClient();
  const { data, error } = await supabase
    .from("ocade_task_comments")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

/** The @mentions in a comment body, de-duplicated and in the order written. */
export function mentionsInComment(body: string): string[] {
  return [...new Set(body.match(/@[a-z0-9][a-z0-9._-]*/gi) ?? [])];
}
