-- The approval queue, where both sides of it can see it.
--
-- WHAT IT IS FOR. The desktop raises an approval when an action needs a human
-- decision; the phone answers it. Those are two devices, and the queue lived in
-- `localStorage` — so the two surfaces could never actually see the same list.
-- The mobile approvals panel had no producer at all: it was permanently empty,
-- and a desktop waiting on a decision waited forever.
--
-- WHY THIS IS NOT `ocade_automation_runs`. That table already carries an
-- approval, and it is deliberately a different one: it approves a step inside a
-- tracked automation run, is decided through that run's own atomic lifecycle
-- functions, and cannot exist without a run. This queue is for actions that are
-- not runs — a Copilot computer-use action a person is asked about once. Giving
-- those a run row to hang an approval from would be the duplicate, not this.
--
-- THE DECISION IS ONE STATEMENT, and that is the point of the function below.
-- The browser store read the row, decided, and wrote it back, so two phones
-- answering at the same moment could both believe they decided it — and the
-- second decision would silently overwrite the first. A conditional update
-- makes exactly one of them the decider and tells the other it was already
-- answered.
--
-- WHAT IS STORED IS ALREADY REDACTED. A summary reaches this table having been
-- through `redactForAudit`, and protected input never reaches it at all.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ocade_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary TEXT NOT NULL CHECK (length(summary) BETWEEN 1 AND 4000),
  risk TEXT NOT NULL CHECK (risk IN ('read_only', 'low', 'confirm', 'high', 'prohibited')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'expired', 'cancelled')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  -- No foreign key to `devices`: a device that is later forgotten must not take
  -- the record of what it decided with it.
  decided_by_device UUID,
  decided_at TIMESTAMPTZ,
  -- An approval that expires before it is raised is not a request, it is a bug
  -- upstream, and storing it would show somebody a decision they cannot make.
  CONSTRAINT ocade_approvals_window CHECK (expires_at > requested_at)
);

-- Both surfaces ask the same question: what is still waiting for me.
CREATE INDEX IF NOT EXISTS ocade_approvals_pending_idx
  ON public.ocade_approvals (user_id, status, expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ocade_approvals TO authenticated;
GRANT ALL ON public.ocade_approvals TO service_role;
ALTER TABLE public.ocade_approvals ENABLE ROW LEVEL SECURITY;

-- `(select auth.uid())` rather than `auth.uid()`: the bare call is re-evaluated
-- for every row the policy filters, while the scalar subquery is an InitPlan
-- run once per statement.
CREATE POLICY "own_approvals" ON public.ocade_approvals FOR ALL
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

/*
 * Decide an approval, atomically.
 *
 * Returns the decided row, or nothing when the approval was already answered,
 * had expired, or belongs to somebody else. The caller reports "already
 * answered" rather than success — a screen that showed a decision which did not
 * take is how two people believe they each approved an action once.
 *
 * SECURITY DEFINER with a pinned search_path, and scoped to `auth.uid()` inside
 * rather than to an account id the caller supplies: there is no argument here
 * that could name somebody else's approval.
 */
CREATE OR REPLACE FUNCTION public.ocade_decide_approval(
  _id UUID,
  _status TEXT,
  _device_id UUID DEFAULT NULL
)
RETURNS public.ocade_approvals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  decided public.ocade_approvals;
BEGIN
  IF _status NOT IN ('approved', 'denied', 'cancelled') THEN
    RAISE EXCEPTION 'An approval can only be approved, denied or cancelled';
  END IF;

  UPDATE public.ocade_approvals
     SET status = _status,
         decided_by_device = COALESCE(_device_id, decided_by_device),
         decided_at = now()
   WHERE id = _id
     AND user_id = auth.uid()
     AND status = 'pending'
     AND expires_at > now()
  RETURNING * INTO decided;

  RETURN decided;
END;
$$;

REVOKE ALL ON FUNCTION public.ocade_decide_approval(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ocade_decide_approval(UUID, TEXT, UUID) TO authenticated;

/*
 * Mark everything that lapsed while nothing was watching.
 *
 * Expiry is applied when the list is read rather than by a scheduled job:
 * expiry that only runs when a background job is healthy is expiry nobody can
 * rely on, and the read that would have shown the stale row is already
 * happening. Returns the rows it changed, so the caller can tell somebody a
 * decision they were waiting for will never arrive.
 */
CREATE OR REPLACE FUNCTION public.ocade_expire_due_approvals()
RETURNS SETOF public.ocade_approvals
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.ocade_approvals
     SET status = 'expired'
   WHERE user_id = auth.uid()
     AND status = 'pending'
     AND expires_at <= now()
  RETURNING *;
$$;

REVOKE ALL ON FUNCTION public.ocade_expire_due_approvals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ocade_expire_due_approvals() TO authenticated;

COMMIT;
