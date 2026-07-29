-- OCADE automation worker persistence lifecycle.
--
-- READY TO APPLY — not applied by Codex.
-- Depends on: 20260722110000_ocade_automations.sql
-- Rollback:     supabase/rollback/20260724211500_ocade_automation_worker_rollback.sql
-- Verification: supabase/verification/20260724211500_ocade_automation_worker_verify.sql

BEGIN;

ALTER TABLE public.ocade_automation_runs
  ADD COLUMN IF NOT EXISTS execution_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS worker_id TEXT,
  ADD COLUMN IF NOT EXISTS claim_token UUID,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pause_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_step_index INTEGER NOT NULL DEFAULT 0
    CHECK (next_step_index >= 0);

ALTER TABLE public.ocade_automation_runs
  DROP CONSTRAINT IF EXISTS ocade_automation_runs_execution_steps_array;
ALTER TABLE public.ocade_automation_runs
  ADD CONSTRAINT ocade_automation_runs_execution_steps_array
  CHECK (jsonb_typeof(execution_steps) = 'array');

COMMENT ON COLUMN public.ocade_automation_runs.execution_steps IS
  'Immutable action snapshot claimed by a worker. Empty for blocked and dry-run rows.';
COMMENT ON COLUMN public.ocade_automation_runs.claim_token IS
  'Opaque compare-and-set token. Worker mutations must present the current token.';
COMMENT ON COLUMN public.ocade_automation_runs.next_step_index IS
  'First step without a verified success receipt; recovery resumes here.';

CREATE TABLE IF NOT EXISTS public.ocade_automation_step_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.ocade_automation_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt INTEGER NOT NULL CHECK (attempt >= 1),
  step_index INTEGER NOT NULL CHECK (step_index >= 0),
  phase TEXT NOT NULL CHECK (phase IN ('execute','rollback')),
  operation_id TEXT NOT NULL CHECK (char_length(operation_id) BETWEEN 1 AND 300),
  action_kind TEXT NOT NULL CHECK (char_length(action_kind) BETWEEN 1 AND 100),
  status TEXT NOT NULL CHECK (status IN ('succeeded','failed','cancelled')),
  execution_ok BOOLEAN NOT NULL,
  verified BOOLEAN NOT NULL,
  detail TEXT NOT NULL CHECK (char_length(detail) <= 4000),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (finished_at >= started_at),
  CHECK (status <> 'succeeded' OR (execution_ok AND verified)),
  UNIQUE (run_id, phase, step_index, attempt),
  UNIQUE (run_id, operation_id, attempt)
);

ALTER TABLE public.ocade_automation_step_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_automation_step_receipts_select"
  ON public.ocade_automation_step_receipts;
CREATE POLICY "own_automation_step_receipts_select"
  ON public.ocade_automation_step_receipts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS ocade_automation_step_receipts_run_idx
  ON public.ocade_automation_step_receipts (run_id, step_index, attempt);

-- Owners may read and enqueue their rows, but worker/approval/cancellation
-- transitions go through the compare-and-set functions below.
DROP POLICY IF EXISTS "own_automation_runs" ON public.ocade_automation_runs;
DROP POLICY IF EXISTS "own_automation_runs_select" ON public.ocade_automation_runs;
DROP POLICY IF EXISTS "own_automation_runs_insert" ON public.ocade_automation_runs;
CREATE POLICY "own_automation_runs_select"
  ON public.ocade_automation_runs
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.ocade_automations AS parent
      WHERE parent.id = automation_id AND parent.user_id = auth.uid()
    )
  );
CREATE POLICY "own_automation_runs_insert"
  ON public.ocade_automation_runs
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.ocade_automations AS parent
      WHERE parent.id = automation_id AND parent.user_id = auth.uid()
    )
    AND (
      (dry_run AND status = 'succeeded' AND jsonb_array_length(execution_steps) = 0)
      OR
      (
        NOT dry_run
        AND status IN ('pending','awaiting_approval','blocked')
        AND (status <> 'blocked' OR jsonb_array_length(execution_steps) = 0)
      )
    )
  );

-- Enqueue and advance the parent schedule under one parent-row lock. This
-- makes a manual click, scheduler tick, and split application instance
-- idempotent without leaving a run inserted while next_run_at remains stale.
CREATE OR REPLACE FUNCTION public.ocade_enqueue_automation_run(
  p_automation_id UUID,
  p_status TEXT,
  p_dry_run BOOLEAN,
  p_plan JSONB,
  p_execution_steps JSONB,
  p_highest_risk TEXT,
  p_blocked_reason TEXT DEFAULT NULL,
  p_deadline_at TIMESTAMPTZ DEFAULT NULL,
  p_next_run_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (id UUID, status TEXT, reused BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_run_id UUID;
  v_existing RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF v_user_id IS NULL
    OR p_automation_id IS NULL
    OR p_status NOT IN ('pending','awaiting_approval','succeeded','blocked')
    OR p_highest_risk NOT IN ('read_only','low','confirm','high','prohibited')
    OR jsonb_typeof(p_plan) <> 'object'
    OR jsonb_typeof(p_execution_steps) <> 'array'
    OR jsonb_array_length(p_execution_steps) > 50
    OR (p_deadline_at IS NOT NULL AND p_deadline_at <= v_now)
    OR (p_next_run_at IS NOT NULL AND p_next_run_at <= v_now)
  THEN
    RAISE EXCEPTION 'Invalid automation enqueue request.'
      USING ERRCODE = '22023';
  END IF;

  -- Serialise starts for one automation before checking for an existing run.
  PERFORM 1
  FROM public.ocade_automations
  WHERE id = p_automation_id AND user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT p_dry_run THEN
    SELECT r.id, r.status INTO v_existing
    FROM public.ocade_automation_runs AS r
    WHERE r.automation_id = p_automation_id
      AND r.user_id = v_user_id
      AND r.dry_run = FALSE
      AND r.status IN ('pending','awaiting_approval','running','paused')
    ORDER BY r.created_at DESC
    LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT v_existing.id, v_existing.status, TRUE;
      RETURN;
    END IF;
  END IF;

  IF
    (
      p_dry_run
      AND (
        p_status NOT IN ('succeeded','blocked')
        OR jsonb_array_length(p_execution_steps) <> 0
      )
    )
    OR
    (
      NOT p_dry_run
      AND (
        p_status NOT IN ('pending','awaiting_approval','blocked')
        OR (
          p_status IN ('pending','awaiting_approval')
          AND jsonb_array_length(p_execution_steps) = 0
        )
        OR (
          p_status = 'blocked'
          AND jsonb_array_length(p_execution_steps) <> 0
        )
      )
    )
  THEN
    RAISE EXCEPTION 'Automation enqueue state does not match its executable steps.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.ocade_automation_runs (
    user_id,
    automation_id,
    status,
    dry_run,
    plan,
    execution_steps,
    highest_risk,
    blocked_reason,
    approval_expires_at,
    deadline_at
  ) VALUES (
    v_user_id,
    p_automation_id,
    p_status,
    p_dry_run,
    p_plan,
    p_execution_steps,
    p_highest_risk,
    CASE WHEN p_status = 'blocked' THEN left(p_blocked_reason, 4000) ELSE NULL END,
    CASE WHEN p_status = 'awaiting_approval' THEN v_now + interval '30 minutes' ELSE NULL END,
    p_deadline_at
  )
  RETURNING ocade_automation_runs.id INTO v_run_id;

  UPDATE public.ocade_automations
  SET last_run_at = v_now,
      next_run_at = CASE WHEN p_dry_run THEN next_run_at ELSE p_next_run_at END
  WHERE id = p_automation_id AND user_id = v_user_id;

  RETURN QUERY SELECT v_run_id, p_status, FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_claim_automation_run(
  p_run_id UUID,
  p_worker_id TEXT
)
RETURNS TABLE (
  id UUID,
  claim_token UUID,
  execution_steps JSONB,
  attempt INTEGER,
  max_attempts INTEGER,
  next_step_index INTEGER,
  confirmed BOOLEAN,
  deadline_at TIMESTAMPTZ,
  approval_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL OR p_worker_id IS NULL OR char_length(trim(p_worker_id)) NOT BETWEEN 1 AND 200 THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.ocade_automation_runs AS r
  SET status = 'running',
      worker_id = trim(p_worker_id),
      claim_token = gen_random_uuid(),
      claimed_at = now(),
      heartbeat_at = now(),
      lease_expires_at = now() + interval '2 minutes',
      started_at = COALESCE(r.started_at, now())
  FROM public.ocade_automations AS a
  WHERE r.id = p_run_id
    AND r.user_id = v_user_id
    AND a.id = r.automation_id
    AND a.user_id = v_user_id
    AND r.status = 'pending'
    AND r.cancel_requested_at IS NULL
    AND r.pause_requested_at IS NULL
    AND (r.deadline_at IS NULL OR r.deadline_at > now())
    AND (
      r.highest_risk IN ('read_only','low')
      OR (
        r.approval_decision = 'approved'
        AND r.approval_expires_at IS NOT NULL
        AND r.approval_expires_at > now()
      )
    )
    AND (r.next_attempt_at IS NULL OR r.next_attempt_at <= now())
    AND jsonb_array_length(r.execution_steps) > 0
  RETURNING
    r.id,
    r.claim_token,
    r.execution_steps,
    r.attempt,
    a.max_attempts,
    r.next_step_index,
    (
      r.highest_risk IN ('read_only','low')
      OR (
        r.approval_decision = 'approved'
        AND r.approval_expires_at IS NOT NULL
        AND r.approval_expires_at > now()
      )
    ),
    r.deadline_at,
    r.approval_expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_heartbeat_automation_run(
  p_run_id UUID,
  p_claim_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF auth.uid() IS NULL OR p_claim_token IS NULL THEN RETURN FALSE; END IF;
  UPDATE public.ocade_automation_runs
  SET heartbeat_at = now(),
      lease_expires_at = now() + interval '2 minutes'
  WHERE id = p_run_id
    AND user_id = auth.uid()
    AND status = 'running'
    AND claim_token = p_claim_token
    AND lease_expires_at > now();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_append_automation_receipt(
  p_run_id UUID,
  p_claim_token UUID,
  p_step_index INTEGER,
  p_phase TEXT,
  p_operation_id TEXT,
  p_action_kind TEXT,
  p_status TEXT,
  p_execution_ok BOOLEAN,
  p_verified BOOLEAN,
  p_detail TEXT,
  p_started_at TIMESTAMPTZ,
  p_finished_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_run public.ocade_automation_runs%ROWTYPE;
  v_existing RECORD;
BEGIN
  IF auth.uid() IS NULL
    OR p_claim_token IS NULL
    OR p_step_index < 0
    OR p_phase NOT IN ('execute','rollback')
    OR p_status NOT IN ('succeeded','failed','cancelled')
    OR (p_status = 'succeeded' AND (NOT p_execution_ok OR NOT p_verified))
    OR p_finished_at < p_started_at
  THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO v_run
  FROM public.ocade_automation_runs
  WHERE id = p_run_id
    AND user_id = auth.uid()
    AND status = 'running'
    AND claim_token = p_claim_token
    AND lease_expires_at > now()
  FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  SELECT operation_id, status, execution_ok, verified INTO v_existing
  FROM public.ocade_automation_step_receipts
  WHERE run_id = p_run_id
    AND step_index = p_step_index
    AND phase = p_phase
    AND attempt = v_run.attempt;
  IF FOUND THEN
    RETURN v_existing.operation_id = p_operation_id
      AND v_existing.status = p_status
      AND v_existing.execution_ok = p_execution_ok
      AND v_existing.verified = p_verified;
  END IF;

  IF p_step_index >= jsonb_array_length(v_run.execution_steps)
    OR (p_phase = 'execute' AND p_step_index <> v_run.next_step_index)
    OR (p_phase = 'rollback' AND p_step_index >= v_run.next_step_index + 1)
  THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.ocade_automation_step_receipts (
    run_id, user_id, attempt, step_index, phase, operation_id, action_kind,
    status, execution_ok, verified, detail, started_at, finished_at
  ) VALUES (
    p_run_id, auth.uid(), v_run.attempt, p_step_index, p_phase,
    left(p_operation_id, 300), left(p_action_kind, 100),
    p_status, p_execution_ok, p_verified, left(COALESCE(p_detail, ''), 4000),
    p_started_at, p_finished_at
  );

  IF p_phase = 'execute' AND p_status = 'succeeded' AND p_verified THEN
    UPDATE public.ocade_automation_runs
    SET next_step_index = next_step_index + 1,
        heartbeat_at = now()
    WHERE id = p_run_id AND claim_token = p_claim_token;
  END IF;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_complete_automation_run(
  p_run_id UUID,
  p_claim_token UUID,
  p_status TEXT,
  p_error TEXT,
  p_finished_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF auth.uid() IS NULL
    OR p_claim_token IS NULL
    OR p_status NOT IN ('succeeded','failed','cancelled')
  THEN
    RETURN FALSE;
  END IF;

  UPDATE public.ocade_automation_runs
  SET status = p_status,
      error = CASE WHEN p_status = 'succeeded' THEN NULL ELSE left(p_error, 4000) END,
      finished_at = p_finished_at,
      cancelled_at = CASE WHEN p_status = 'cancelled' THEN p_finished_at ELSE cancelled_at END,
      worker_id = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      heartbeat_at = NULL,
      lease_expires_at = NULL
  WHERE id = p_run_id
    AND user_id = auth.uid()
    AND status = 'running'
    AND claim_token = p_claim_token
    AND lease_expires_at > now()
    AND (
      p_status <> 'succeeded'
      OR next_step_index >= jsonb_array_length(execution_steps)
    );
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_requeue_automation_run(
  p_run_id UUID,
  p_claim_token UUID,
  p_attempt INTEGER,
  p_next_attempt_at TIMESTAMPTZ,
  p_error TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF auth.uid() IS NULL OR p_claim_token IS NULL THEN RETURN FALSE; END IF;
  UPDATE public.ocade_automation_runs AS r
  SET status = 'pending',
      attempt = p_attempt,
      next_attempt_at = p_next_attempt_at,
      error = left(p_error, 4000),
      worker_id = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      heartbeat_at = NULL,
      lease_expires_at = NULL
  FROM public.ocade_automations AS a
  WHERE r.id = p_run_id
    AND r.user_id = auth.uid()
    AND a.id = r.automation_id
    AND r.status = 'running'
    AND r.claim_token = p_claim_token
    AND r.lease_expires_at > now()
    AND r.cancel_requested_at IS NULL
    AND r.pause_requested_at IS NULL
    AND p_attempt = r.attempt + 1
    AND p_attempt <= a.max_attempts
    AND p_next_attempt_at > now();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_suspend_automation_run(
  p_run_id UUID,
  p_claim_token UUID,
  p_reason TEXT,
  p_paused_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF auth.uid() IS NULL OR p_claim_token IS NULL OR p_paused_at > now() THEN
    RETURN FALSE;
  END IF;
  UPDATE public.ocade_automation_runs
  SET status = 'paused',
      error = left(COALESCE(p_reason, 'Paused by the user.'), 4000),
      pause_requested_at = NULL,
      worker_id = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      heartbeat_at = NULL,
      lease_expires_at = NULL
  WHERE id = p_run_id
    AND user_id = auth.uid()
    AND status = 'running'
    AND claim_token = p_claim_token
    AND lease_expires_at > now()
    AND cancel_requested_at IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_request_automation_pause(p_run_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  UPDATE public.ocade_automation_runs
  SET status = CASE WHEN status IN ('pending','awaiting_approval') THEN 'paused' ELSE status END,
      pause_requested_at = CASE WHEN status = 'running' THEN now() ELSE NULL END,
      error = CASE
        WHEN status IN ('pending','awaiting_approval') THEN 'Paused by the user.'
        ELSE error
      END
  WHERE id = p_run_id
    AND user_id = auth.uid()
    AND status IN ('pending','awaiting_approval','running')
    AND cancel_requested_at IS NULL
  RETURNING CASE WHEN status = 'paused' THEN 'paused' ELSE 'pause_requested' END
  INTO v_status;
  RETURN v_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_expire_automation_approval(
  p_run_id UUID,
  p_claim_token UUID,
  p_reason TEXT,
  p_requested_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF auth.uid() IS NULL OR p_claim_token IS NULL OR p_requested_at > now() THEN
    RETURN FALSE;
  END IF;
  UPDATE public.ocade_automation_runs
  SET status = 'awaiting_approval',
      approval_decision = NULL,
      approved_at = NULL,
      approval_expires_at = now() + interval '30 minutes',
      error = left(COALESCE(p_reason, 'Approval expired.'), 4000),
      worker_id = NULL,
      claim_token = NULL,
      claimed_at = NULL,
      heartbeat_at = NULL,
      lease_expires_at = NULL
  WHERE id = p_run_id
    AND user_id = auth.uid()
    AND status = 'running'
    AND claim_token = p_claim_token
    AND lease_expires_at > now()
    AND cancel_requested_at IS NULL
    AND pause_requested_at IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_resume_automation_run(p_run_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  UPDATE public.ocade_automation_runs
  SET status = CASE
        WHEN highest_risk IN ('read_only','low') THEN 'pending'
        WHEN approval_decision = 'approved'
          AND approval_expires_at IS NOT NULL
          AND approval_expires_at > now()
        THEN 'pending'
        ELSE 'awaiting_approval'
      END,
      pause_requested_at = NULL,
      error = NULL,
      next_attempt_at = NULL
  WHERE id = p_run_id
    AND user_id = auth.uid()
    AND status = 'paused'
    AND cancel_requested_at IS NULL
    AND (deadline_at IS NULL OR deadline_at > now())
  RETURNING status INTO v_status;
  RETURN v_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_decide_automation_run(
  p_run_id UUID,
  p_decision TEXT,
  p_device_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF auth.uid() IS NULL OR p_decision NOT IN ('approved','denied') THEN RETURN NULL; END IF;
  UPDATE public.ocade_automation_runs
  SET status = CASE WHEN p_decision = 'approved' THEN 'pending' ELSE 'cancelled' END,
      approval_decision = p_decision,
      approved_at = now(),
      approved_by_device = p_device_id,
      finished_at = CASE WHEN p_decision = 'denied' THEN now() ELSE NULL END
  WHERE id = p_run_id
    AND user_id = auth.uid()
    AND status = 'awaiting_approval'
    AND approval_expires_at IS NOT NULL
    AND approval_expires_at > now()
  RETURNING status INTO v_status;
  IF v_status IS NULL THEN
    UPDATE public.ocade_automation_runs
    SET status = 'cancelled',
        error = 'The approval request expired before it was answered.',
        finished_at = now()
    WHERE id = p_run_id
      AND user_id = auth.uid()
      AND status = 'awaiting_approval'
      AND (approval_expires_at IS NULL OR approval_expires_at <= now());
    IF FOUND THEN RETURN 'approval_expired'; END IF;
  END IF;
  RETURN v_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_request_automation_cancel(p_run_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  UPDATE public.ocade_automation_runs
  SET status = CASE WHEN status IN ('pending','awaiting_approval','paused') THEN 'cancelled' ELSE status END,
      cancel_requested_at = now(),
      cancelled_at = CASE WHEN status IN ('pending','awaiting_approval','paused') THEN now() ELSE cancelled_at END,
      finished_at = CASE WHEN status IN ('pending','awaiting_approval','paused') THEN now() ELSE finished_at END
  WHERE id = p_run_id
    AND user_id = auth.uid()
    AND status IN ('pending','awaiting_approval','running','paused')
  RETURNING CASE WHEN status = 'cancelled' THEN 'cancelled' ELSE 'cancellation_requested' END
  INTO v_status;
  RETURN v_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_cancel_all_automation_runs()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cancelled INTEGER;
  v_requested INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  UPDATE public.ocade_automation_runs
  SET status = 'cancelled',
      cancel_requested_at = now(),
      cancelled_at = now(),
      finished_at = now()
  WHERE user_id = auth.uid() AND status IN ('pending','awaiting_approval','paused');
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;

  UPDATE public.ocade_automation_runs
  SET cancel_requested_at = now()
  WHERE user_id = auth.uid() AND status = 'running';
  GET DIAGNOSTICS v_requested = ROW_COUNT;
  RETURN jsonb_build_object('cancelled', v_cancelled, 'cancellation_requested', v_requested);
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_recover_stale_automation_runs(
  p_stale_before TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_paused INTEGER := 0;
  v_expired INTEGER := 0;
  v_cancelled INTEGER := 0;
  v_failed INTEGER := 0;
  v_requeued INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL OR p_stale_before >= now() THEN RETURN NULL; END IF;

  UPDATE public.ocade_automation_runs
  SET status = 'paused',
      error = 'The worker stopped heartbeating after pause was requested; resume will continue from the first unverified step.',
      pause_requested_at = NULL,
      worker_id = NULL, claim_token = NULL, claimed_at = NULL, heartbeat_at = NULL,
      lease_expires_at = NULL
  WHERE user_id = auth.uid()
    AND status = 'running'
    AND lease_expires_at <= now()
    AND (heartbeat_at IS NULL OR heartbeat_at < p_stale_before)
    AND pause_requested_at IS NOT NULL
    AND cancel_requested_at IS NULL;
  GET DIAGNOSTICS v_paused = ROW_COUNT;

  UPDATE public.ocade_automation_runs
  SET status = 'cancelled', cancelled_at = now(), finished_at = now(),
      worker_id = NULL, claim_token = NULL, claimed_at = NULL, heartbeat_at = NULL,
      lease_expires_at = NULL
  WHERE user_id = auth.uid()
    AND status = 'running'
    AND lease_expires_at <= now()
    AND (heartbeat_at IS NULL OR heartbeat_at < p_stale_before)
    AND cancel_requested_at IS NOT NULL;
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;

  UPDATE public.ocade_automation_runs
  SET status = 'failed',
      error = 'The run deadline expired before execution could complete.',
      finished_at = now(),
      worker_id = NULL, claim_token = NULL, claimed_at = NULL, heartbeat_at = NULL,
      lease_expires_at = NULL
  WHERE user_id = auth.uid()
    AND status IN ('pending','running')
    AND (
      status = 'pending'
      OR lease_expires_at IS NULL
      OR lease_expires_at <= now()
    )
    AND deadline_at IS NOT NULL
    AND deadline_at <= now()
    AND cancel_requested_at IS NULL
    AND pause_requested_at IS NULL;
  GET DIAGNOSTICS v_expired = ROW_COUNT;

  UPDATE public.ocade_automation_runs AS r
  SET status = 'failed', error = 'The worker stopped heartbeating and the retry budget was exhausted.',
      finished_at = now(), worker_id = NULL, claim_token = NULL,
      claimed_at = NULL, heartbeat_at = NULL, lease_expires_at = NULL
  FROM public.ocade_automations AS a
  WHERE r.user_id = auth.uid()
    AND a.id = r.automation_id
    AND r.status = 'running'
    AND r.lease_expires_at <= now()
    AND (r.heartbeat_at IS NULL OR r.heartbeat_at < p_stale_before)
    AND r.cancel_requested_at IS NULL
    AND r.pause_requested_at IS NULL
    AND r.attempt >= a.max_attempts;
  GET DIAGNOSTICS v_failed = ROW_COUNT;

  UPDATE public.ocade_automation_runs AS r
  SET status = 'pending',
      attempt = r.attempt + 1,
      next_attempt_at = now() + make_interval(
        secs => LEAST(900, (power(2, GREATEST(0, r.attempt - 1)) * 60)::INTEGER)
      ),
      error = 'The worker stopped heartbeating; the run will resume from its first unverified step.',
      worker_id = NULL, claim_token = NULL, claimed_at = NULL, heartbeat_at = NULL,
      lease_expires_at = NULL
  FROM public.ocade_automations AS a
  WHERE r.user_id = auth.uid()
    AND a.id = r.automation_id
    AND r.status = 'running'
    AND r.lease_expires_at <= now()
    AND (r.heartbeat_at IS NULL OR r.heartbeat_at < p_stale_before)
    AND r.cancel_requested_at IS NULL
    AND r.pause_requested_at IS NULL
    AND r.attempt < a.max_attempts;
  GET DIAGNOSTICS v_requeued = ROW_COUNT;

  RETURN jsonb_build_object(
    'paused', v_paused,
    'expired', v_expired,
    'cancelled', v_cancelled,
    'failed', v_failed,
    'requeued', v_requeued
  );
END;
$$;

-- Receipts are append-only for application roles. The owner-rights append
-- function is the sole write path and enforces claim/idempotency
-- invariants; neither authenticated nor service_role can rewrite evidence.
REVOKE ALL ON TABLE public.ocade_automation_step_receipts
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.ocade_automation_step_receipts
  TO authenticated, service_role;

-- Run lifecycle mutations are RPC-only after this migration.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.ocade_automation_runs FROM authenticated;
GRANT SELECT ON TABLE public.ocade_automation_runs TO authenticated;

REVOKE ALL ON FUNCTION public.ocade_enqueue_automation_run(UUID, TEXT, BOOLEAN, JSONB, JSONB, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_claim_automation_run(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_heartbeat_automation_run(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_append_automation_receipt(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_complete_automation_run(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_requeue_automation_run(UUID, UUID, INTEGER, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_suspend_automation_run(UUID, UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_request_automation_pause(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_expire_automation_approval(UUID, UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_resume_automation_run(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_decide_automation_run(UUID, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_request_automation_cancel(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_cancel_all_automation_runs() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_recover_stale_automation_runs(TIMESTAMPTZ) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ocade_enqueue_automation_run(UUID, TEXT, BOOLEAN, JSONB, JSONB, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ocade_claim_automation_run(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ocade_heartbeat_automation_run(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ocade_append_automation_receipt(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ocade_complete_automation_run(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ocade_requeue_automation_run(UUID, UUID, INTEGER, TIMESTAMPTZ, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ocade_suspend_automation_run(UUID, UUID, TEXT, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ocade_request_automation_pause(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ocade_expire_automation_approval(UUID, UUID, TEXT, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ocade_resume_automation_run(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ocade_decide_automation_run(UUID, TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ocade_request_automation_cancel(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ocade_cancel_all_automation_runs() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ocade_recover_stale_automation_runs(TIMESTAMPTZ) TO authenticated, service_role;

COMMIT;
