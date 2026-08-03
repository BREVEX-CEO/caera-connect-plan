-- ROLLBACK for 20260724211500_ocade_automation_worker.sql
--
-- Destructive: deletes per-step receipts and worker claim/recovery metadata.
-- The original automation/run tables and run history remain.

BEGIN;

DROP FUNCTION IF EXISTS public.ocade_recover_stale_automation_runs(TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.ocade_resume_automation_run(UUID);
DROP FUNCTION IF EXISTS public.ocade_request_automation_pause(UUID);
DROP FUNCTION IF EXISTS public.ocade_expire_automation_approval(UUID, UUID, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.ocade_suspend_automation_run(UUID, UUID, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.ocade_cancel_all_automation_runs();
DROP FUNCTION IF EXISTS public.ocade_request_automation_cancel(UUID);
DROP FUNCTION IF EXISTS public.ocade_decide_automation_run(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.ocade_requeue_automation_run(UUID, UUID, INTEGER, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.ocade_complete_automation_run(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.ocade_append_automation_receipt(
  UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT, TIMESTAMPTZ, TIMESTAMPTZ
);
DROP FUNCTION IF EXISTS public.ocade_heartbeat_automation_run(UUID, UUID);
DROP FUNCTION IF EXISTS public.ocade_claim_automation_run(UUID, TEXT);
DROP FUNCTION IF EXISTS public.ocade_enqueue_automation_run(
  UUID, TEXT, BOOLEAN, JSONB, JSONB, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ
);

DROP TABLE IF EXISTS public.ocade_automation_step_receipts;

DROP POLICY IF EXISTS "own_automation_runs_select" ON public.ocade_automation_runs;
DROP POLICY IF EXISTS "own_automation_runs_insert" ON public.ocade_automation_runs;
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

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ocade_automation_runs TO authenticated;

ALTER TABLE public.ocade_automation_runs
  DROP CONSTRAINT IF EXISTS ocade_automation_runs_execution_steps_array,
  DROP COLUMN IF EXISTS execution_steps,
  DROP COLUMN IF EXISTS worker_id,
  DROP COLUMN IF EXISTS claim_token,
  DROP COLUMN IF EXISTS claimed_at,
  DROP COLUMN IF EXISTS heartbeat_at,
  DROP COLUMN IF EXISTS lease_expires_at,
  DROP COLUMN IF EXISTS cancel_requested_at,
  DROP COLUMN IF EXISTS pause_requested_at,
  DROP COLUMN IF EXISTS approval_expires_at,
  DROP COLUMN IF EXISTS deadline_at,
  DROP COLUMN IF EXISTS next_step_index;

COMMIT;
