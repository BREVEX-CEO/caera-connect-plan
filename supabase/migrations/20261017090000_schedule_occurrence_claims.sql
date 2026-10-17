-- PLAN Phase 06 V09: a schedule's occurrence is never used up without its reminder or task.
--
-- The run used to advance next_at first and then create the reminder or task; a process that
-- died in between lost that occurrence for good. The claim now records which occurrence is
-- being run and when, in the same statement that advances the schedule; a later tick finishes
-- a claim left behind. A task started for an occurrence carries that occurrence, so finishing
-- it again never starts a second task.
BEGIN;
ALTER TABLE public.jarvis_schedules
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_occurrence timestamptz;
CREATE INDEX IF NOT EXISTS jarvis_schedules_claimed_idx
  ON public.jarvis_schedules (claimed_at) WHERE claimed_at IS NOT NULL;
ALTER TABLE public.jarvis_tasks
  ADD COLUMN IF NOT EXISTS schedule_occurrence text;
ALTER TABLE public.jarvis_tasks
  DROP CONSTRAINT IF EXISTS jarvis_tasks_schedule_occurrence_check;
ALTER TABLE public.jarvis_tasks
  ADD CONSTRAINT jarvis_tasks_schedule_occurrence_check
  CHECK (schedule_occurrence IS NULL OR length(schedule_occurrence) <= 120);
CREATE UNIQUE INDEX IF NOT EXISTS jarvis_tasks_one_per_schedule_occurrence
  ON public.jarvis_tasks (schedule_occurrence) WHERE schedule_occurrence IS NOT NULL;
COMMIT;
