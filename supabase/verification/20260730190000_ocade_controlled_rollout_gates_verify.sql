-- Self-checking verification for OCADE P28 controlled-rollout gates.
DO $$
DECLARE
  gate_count integer;
BEGIN
  SELECT count(*) INTO gate_count
  FROM public.launch_gate_items
  WHERE key = ANY(ARRAY[
    'alpha_cohort',
    'alpha_task_library',
    'alpha_endurance_recovery',
    'alpha_performance',
    'alpha_usability',
    'alpha_security_review',
    'alpha_exit_review',
    'beta_enrolment',
    'beta_telemetry_consent',
    'beta_coverage_limits',
    'beta_exit_review'
  ]);
  IF gate_count <> 11 THEN
    RAISE EXCEPTION 'expected 11 controlled-rollout gates, found %', gate_count;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.launch_gate_items
    WHERE key LIKE 'alpha_%' OR key LIKE 'beta_%'
    GROUP BY key
    HAVING bool_or(blocker = false)
  ) THEN
    RAISE EXCEPTION 'controlled-rollout gate is not a blocker';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgname = 'launch_gate_enforce_controlled_evidence' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'missing controlled evidence trigger';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgname = 'feature_flags_enforce_controlled_rollout' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'missing controlled rollout stage trigger';
  END IF;
  RAISE NOTICE 'verify 20260730190000 controlled rollout gates OK';
END;
$$;
