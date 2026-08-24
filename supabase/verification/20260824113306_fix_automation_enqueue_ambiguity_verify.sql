-- Assert that the live enqueue function contains the qualified aliases that
-- remove the red-first ambiguous-id failure.
DO $$
DECLARE
  definition TEXT;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(p.oid)
  INTO definition
  FROM pg_catalog.pg_proc AS p
  JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'ocade_enqueue_automation_run'
    AND pg_catalog.pg_get_function_identity_arguments(p.oid) =
      'p_automation_id uuid, p_status text, p_dry_run boolean, p_plan jsonb, p_execution_steps jsonb, p_highest_risk text, p_blocked_reason text, p_deadline_at timestamp with time zone, p_next_run_at timestamp with time zone';

  IF definition IS NULL
    OR position('automation.id = p_automation_id' IN definition) = 0
    OR position('SELECT r.id, r.status' IN definition) = 0
    OR position('RETURNING ocade_automation_runs.id' IN definition) = 0
  THEN
    RAISE EXCEPTION 'Automation enqueue ambiguity fix verification failed.';
  END IF;
END;
$$;
