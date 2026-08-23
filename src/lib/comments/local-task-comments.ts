export interface LocalTaskComment {
  id: string;
  taskId: string;
  parentId: string | null;
  author: "You on this device";
  body: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  archivedAt: string | null;
  reacted: boolean;
}

const STORAGE_KEY = "ocade:task-comments:v1";

function readAll(): LocalTaskComment[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as LocalTaskComment[]) : [];
  } catch {
    return [];
  }
}

function writeAll(comments: LocalTaskComment[]) {
  if (typeof localStorage !== "undefined")
    localStorage.setItem(STORAGE_KEY, JSON.stringify(comments.slice(-1000)));
}

export function listTaskComments(taskId: string, includeArchived = false) {
  return readAll()
    .filter((comment) => comment.taskId === taskId && (includeArchived || !comment.archivedAt))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function createTaskComment(
  input: { taskId: string; body: string; parentId?: string | null },
  at = new Date().toISOString(),
  id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `comment-${Date.now()}-${Math.random().toString(36).slice(2)}`,
) {
  const body = input.body.trim();
  if (!input.taskId.trim()) throw new Error("A comment needs a task anchor.");
  if (!body) throw new Error("Write a comment before posting.");
  const all = readAll();
  if (input.parentId && !all.some((comment) => comment.id === input.parentId && comment.taskId === input.taskId))
    throw new Error("That reply target is no longer available.");
  const comment: LocalTaskComment = {
    id,
    taskId: input.taskId,
    parentId: input.parentId ?? null,
    author: "You on this device",
    body,
    createdAt: at,
    updatedAt: at,
    resolvedAt: null,
    archivedAt: null,
    reacted: false,
  };
  writeAll([...all, comment]);
  return comment;
}

function patchComment(id: string, patch: Partial<LocalTaskComment>, at = new Date().toISOString()) {
  const all = readAll();
  const current = all.find((comment) => comment.id === id);
  if (!current) throw new Error("That comment no longer exists.");
  const next = { ...current, ...patch, updatedAt: at };
  writeAll(all.map((comment) => (comment.id === id ? next : comment)));
  return next;
}

export function editTaskComment(id: string, body: string, at?: string) {
  const clean = body.trim();
  if (!clean) throw new Error("A comment cannot be empty.");
  return patchComment(id, { body: clean }, at);
}

export function setTaskCommentResolved(id: string, resolved: boolean, at = new Date().toISOString()) {
  return patchComment(id, { resolvedAt: resolved ? at : null }, at);
}

export function setTaskCommentArchived(id: string, archived: boolean, at = new Date().toISOString()) {
  return patchComment(id, { archivedAt: archived ? at : null }, at);
}

export function toggleTaskCommentReaction(id: string, at?: string) {
  const current = readAll().find((comment) => comment.id === id);
  if (!current) throw new Error("That comment no longer exists.");
  return patchComment(id, { reacted: !current.reacted }, at);
}

export function deleteTaskComment(id: string) {
  const all = readAll();
  if (!all.some((comment) => comment.id === id)) return false;
  writeAll(all.filter((comment) => comment.id !== id));
  return true;
}

export function mentionsInComment(body: string) {
  return [...new Set(body.match(/@[a-z0-9][a-z0-9._-]*/gi) ?? [])];
}
