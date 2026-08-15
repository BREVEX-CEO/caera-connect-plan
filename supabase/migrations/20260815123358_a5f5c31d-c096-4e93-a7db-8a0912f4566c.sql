-- OCADE automations and run history (Plan §33, decision #16).
--
-- READY TO APPLY — not yet applied. Backs the existing, unit-tested engine in
-- src/lib/ocade-automations.ts (planning, scheduling, approval, retry, cancel).
-- Rollback:     supabase/rollback/20260722110000_ocade_automations_rollback.sql
-- Verification: supabase/verification/20260722110000_ocade_automations_verify.sql

BEGIN;

-- ------------------------------------------------------------ automations --
CREATE TABLE IF NOT EXISTS public.ocade_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  -- Mirrors AutomationTrigger: {kind:'manual'|'interval'|'daily'|'condition', ...}
  trigger JSONB NOT NULL DEFAULT '{"kind":"manual"}'::jsonb,
  -- Mirrors CompanionAction[]; every action is risk-classified at run time.
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
  dry_run BOOLEAN NOT NULL DEFAULT FALSE,
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  -- Scheduler bookkeeping; NULL for manual automations.
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(actions) = 'array'),
  CHECK (jsonb_typeof(trigger) = 'object')
);

REVOKE ALL ON TABLE public.ocade_automations FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ocade_automations TO authenticated;
GRANT ALL ON TABLE public.ocade_automations TO service_role;

ALTER TABLE public.ocade_automations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_automations" ON public.ocade_automations;
CREATE POLICY "own_automations" ON public.ocade_automations FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS ocade_automations_user_idx
  ON public.ocade_automations (user_id, enabled, updated_at DESC);

-- Scheduler lookup: only enabled, unpaused, actually-due automations.
CREATE INDEX IF NOT EXISTS ocade_automations_due_idx
  ON public.ocade_automations (next_run_at)
  WHERE enabled AND NOT paused AND next_run_at IS NOT NULL;

DROP TRIGGER IF EXISTS ocade_automations_touch ON public.ocade_automations;
CREATE TRIGGER ocade_automations_touch
  BEFORE UPDATE ON public.ocade_automations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------ runs --
CREATE TABLE IF NOT EXISTS public.ocade_automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  automation_id UUID NOT NULL REFERENCES public.ocade_automations(id) ON DELETE CASCADE,
  -- Mirrors RunStatus in the engine.
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','awaiting_approval','running','paused','succeeded','failed','cancelled','blocked')),
  attempt INTEGER NOT NULL DEFAULT 1 CHECK (attempt >= 1),
  dry_run BOOLEAN NOT NULL DEFAULT FALSE,
  -- Redacted RunPlan snapshot: protected input is never stored here.
  plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  highest_risk TEXT CHECK (highest_risk IN ('read_only','low','confirm','high','prohibited')),
  blocked_reason TEXT,
  error TEXT,
  approved_at TIMESTAMPTZ,
  approval_decision TEXT CHECK (approval_decision IN ('approved','denied')),
  -- Which paired device approved it (mobile approvals), for the audit trail.
  approved_by_device UUID,
  cancelled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.ocade_automation_runs FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ocade_automation_runs TO authenticated;
GRANT ALL ON TABLE public.ocade_automation_runs TO service_role;

ALTER TABLE public.ocade_automation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_automation_runs" ON public.ocade_automation_runs;
CREATE POLICY "own_automation_runs" ON public.ocade_automation_runs FOR ALL
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.ocade_automations AS parent
      WHERE parent.id = automation_id AND parent.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.ocade_automations AS parent
      WHERE parent.id = automation_id AND parent.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS ocade_automation_runs_automation_idx
  ON public.ocade_automation_runs (automation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ocade_automation_runs_user_idx
  ON public.ocade_automation_runs (user_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ocade_automation_runs_one_in_flight_idx
  ON public.ocade_automation_runs (automation_id)
  WHERE dry_run = false AND status IN ('pending', 'awaiting_approval', 'running', 'paused');

COMMENT ON INDEX public.ocade_automation_runs_one_in_flight_idx IS
  'Guarantees at most one in-flight (non-dry) run per automation, so a race between the scheduler and a manual start cannot double-execute.';

COMMENT ON TABLE public.ocade_automations IS
  'OCADE automations. Actions are risk-classified and prohibited (credential) actions can never execute.';
COMMENT ON COLUMN public.ocade_automation_runs.plan IS
  'Redacted RunPlan snapshot for audit/replay. Protected input is stripped before storage.';

COMMIT;