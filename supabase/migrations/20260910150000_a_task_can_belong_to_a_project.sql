-- A task can belong to a project.
--
-- `docs/APP_FLOW.md` describes a project as the thing that "connects chats,
-- files, Code sessions, tasks, artifacts, memory, permissions and activity",
-- and says plainly that it does this by creating typed relationships rather
-- than copies. Six of those eight already existed: a conversation carries
-- `project_id`, a file carries it, an output carries it, a memory carries it.
-- A TASK DID NOT, so the one kind of record that represents work in progress
-- was the one kind that could not be filed with the work it belonged to.
--
-- The effect was quiet and annoying rather than dramatic: a project workspace
-- could show you the conversation where a piece of work was agreed and the
-- artifact it eventually produced, and nothing at all about the task in
-- between.
--
-- ON DELETE SET NULL, DELIBERATELY. Deleting a project must not delete the
-- work. `ocade_conversations` already made this choice — the project delete
-- path keeps conversations and unfiles them — and a task is worth at least as
-- much: somebody tidying up their projects on a Friday must not discover on
-- Monday that a scheduled task went with one.
--
-- The index is not optional. Every cascade and every filtered read on this
-- column is a project workspace asking "what belongs to me", and without it
-- that question scans every task on the account.

BEGIN;

ALTER TABLE public.ocade_tasks
  ADD COLUMN IF NOT EXISTS project_id UUID
  REFERENCES public.ocade_projects(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.ocade_tasks.project_id IS
  'The project this task belongs to, or NULL when it is unfiled. Set to NULL rather than cascaded when the project is deleted: deleting a project must not delete the work.';

CREATE INDEX IF NOT EXISTS ocade_tasks_project_idx
  ON public.ocade_tasks (project_id, updated_at DESC)
  WHERE project_id IS NOT NULL;

COMMIT;
