-- JARVIS schedules: reminders, and work a person asked JARVIS to start later.
--
-- A reminder has no computer: at its time the person is notified and the
-- reminder appears in its conversation. Scheduled work names the computer that
-- does it: at its time a task starts there and the computer carries it on,
-- which it does only while the person keeps Background Mode and Scheduled work
-- on for that computer. Nothing here runs anything by itself; OCADE's clock
-- (the Worker's cron) reads due rows and each run is claimed exactly once.
--
-- People read and remove their own schedules. Creating one, and advancing it,
-- happen only on the server, after the conversation and computer are checked.

CREATE TABLE IF NOT EXISTS public.jarvis_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.ocade_conversations(id) ON DELETE CASCADE,
  -- NULL: a reminder. Otherwise the computer that does the work.
  device_id uuid REFERENCES public.jarvis_devices(id) ON DELETE CASCADE,
  what text NOT NULL,
  next_at timestamptz NOT NULL,
  repeat text NOT NULL DEFAULT 'none',
  -- The person's own time zone, so "every day at 9" stays at 9 across clock changes.
  time_zone text NOT NULL DEFAULT 'UTC',
  active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_outcome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jarvis_schedules_what_check CHECK (length(btrim(what)) BETWEEN 1 AND 500),
  CONSTRAINT jarvis_schedules_repeat_check CHECK (repeat IN ('none', 'daily', 'weekdays', 'weekly')),
  CONSTRAINT jarvis_schedules_zone_check CHECK (length(time_zone) BETWEEN 1 AND 64),
  CONSTRAINT jarvis_schedules_outcome_check CHECK (last_outcome IS NULL OR length(last_outcome) <= 300)
);
CREATE INDEX IF NOT EXISTS jarvis_schedules_due_idx
  ON public.jarvis_schedules (next_at) WHERE active;
CREATE INDEX IF NOT EXISTS jarvis_schedules_user_idx
  ON public.jarvis_schedules (user_id, next_at);
CREATE INDEX IF NOT EXISTS jarvis_schedules_conversation_idx
  ON public.jarvis_schedules (conversation_id);
CREATE INDEX IF NOT EXISTS jarvis_schedules_device_idx
  ON public.jarvis_schedules (device_id);

ALTER TABLE public.jarvis_schedules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.jarvis_schedules FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON TABLE public.jarvis_schedules TO authenticated;
GRANT ALL ON TABLE public.jarvis_schedules TO service_role;
DROP POLICY IF EXISTS jarvis_schedules_read_own ON public.jarvis_schedules;
CREATE POLICY jarvis_schedules_read_own ON public.jarvis_schedules FOR SELECT
  TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS jarvis_schedules_remove_own ON public.jarvis_schedules;
CREATE POLICY jarvis_schedules_remove_own ON public.jarvis_schedules FOR DELETE
  TO authenticated USING ((SELECT auth.uid()) = user_id);
