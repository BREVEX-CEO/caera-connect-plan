-- Tasks and their comments, in the account.
--
-- The unified task list lived in IndexedDB with a `localStorage` fallback, and
-- comments on those tasks lived in `localStorage`. Both are ordinary user
-- content, and `PLAN.md` Phase 2 gives that one persistent authority. The
-- symptom on the way there was visible: a comment was authored by "You on this
-- device", which was the interface admitting it could not say who wrote it or
-- where it would be readable.
--
-- WHY THIS IS NOT `ocade_automation_runs`. A run is one execution of an
-- automation, owned by the worker that claims it and moved by that table's own
-- lifecycle functions. A task is the USER-FACING piece of work: it may come from
-- an automation run — `source = 'automation'`, `source_ref` naming the run — but
-- it may equally come from Chat, Code, research or a monitor, and it outlives
-- any single run through retries. `source` and `source_ref` are what tie the two
-- together without either pretending to be the other.
--
-- STATUS IS CONSTRAINED HERE AS WELL AS IN THE CODE. The transition rules stay
-- in `unified-task.ts`, which is where they are testable; the column refuses a
-- status that is not one of the nine, because a value nothing renders reads on
-- screen as a task that has silently stopped existing.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ocade_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL
    CHECK (source IN ('automation', 'work', 'code', 'research', 'monitor', 'system')),
  -- What this task is a task FOR, in its own system: an automation run id, a
  -- conversation id, a workspace id. Deliberately not a foreign key — a task
  -- must survive the deletion of the thing that started it, or its history
  -- disappears with it.
  source_ref TEXT CHECK (source_ref IS NULL OR length(source_ref) <= 300),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 500),
  request TEXT CHECK (request IS NULL OR length(request) <= 20000),
  current_step TEXT CHECK (current_step IS NULL OR length(current_step) <= 500),
  status TEXT NOT NULL CHECK (status IN (
    'CREATED', 'PLANNING', 'WAITING_PERMISSION', 'EXECUTING',
    'WAITING_USER', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'
  )),
  -- 0 to 1. Outside that range it is not progress, it is a bug rendering as a
  -- bar that is empty or past its end.
  progress DOUBLE PRECISION CHECK (progress IS NULL OR (progress >= 0 AND progress <= 1)),
  device_id TEXT CHECK (device_id IS NULL OR length(device_id) <= 300),
  agent TEXT CHECK (agent IS NULL OR length(agent) <= 300),
  permission_requirements TEXT[] NOT NULL DEFAULT '{}',
  input_refs TEXT[] NOT NULL DEFAULT '{}',
  output_refs TEXT[] NOT NULL DEFAULT '{}',
  receipts TEXT[] NOT NULL DEFAULT '{}',
  dependency_task_ids TEXT[] NOT NULL DEFAULT '{}',
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  last_error TEXT CHECK (last_error IS NULL OR length(last_error) <= 4000),
  scheduled_for TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every list of tasks is "mine, most recently changed first".
CREATE INDEX IF NOT EXISTS ocade_tasks_user_updated_idx
  ON public.ocade_tasks (user_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ocade_tasks TO authenticated;
GRANT ALL ON public.ocade_tasks TO service_role;
ALTER TABLE public.ocade_tasks ENABLE ROW LEVEL SECURITY;

-- `(select auth.uid())` rather than `auth.uid()`: the bare call is re-evaluated
-- per row, the scalar subquery is an InitPlan run once per statement.
CREATE POLICY "own_tasks" ON public.ocade_tasks FOR ALL
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.ocade_task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.ocade_tasks(id) ON DELETE CASCADE,
  -- A reply goes when the comment it replies to goes: an orphaned reply reads
  -- as an answer to a question nobody can see.
  parent_id UUID REFERENCES public.ocade_task_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 10000),
  resolved_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  reacted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A thread is read oldest-first, per task.
CREATE INDEX IF NOT EXISTS ocade_task_comments_task_idx
  ON public.ocade_task_comments (task_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ocade_task_comments TO authenticated;
GRANT ALL ON public.ocade_task_comments TO service_role;
ALTER TABLE public.ocade_task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_task_comments" ON public.ocade_task_comments FOR ALL
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

COMMIT;
