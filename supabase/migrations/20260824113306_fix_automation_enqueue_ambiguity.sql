-- Red-first live probe found that RETURNS TABLE's output parameter named "id"
-- made two unqualified automation-table references ambiguous at execution time.

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

  PERFORM 1
  FROM public.ocade_automations AS automation
  WHERE automation.id = p_automation_id
    AND automation.user_id = v_user_id
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

  UPDATE public.ocade_automations AS automation
  SET last_run_at = v_now,
      next_run_at = CASE
        WHEN p_dry_run THEN automation.next_run_at
        ELSE p_next_run_at
      END
  WHERE automation.id = p_automation_id
    AND automation.user_id = v_user_id;

  RETURN QUERY SELECT v_run_id, p_status, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.ocade_enqueue_automation_run(
  UUID, TEXT, BOOLEAN, JSONB, JSONB, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_enqueue_automation_run(
  UUID, TEXT, BOOLEAN, JSONB, JSONB, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ
) TO authenticated, service_role;
