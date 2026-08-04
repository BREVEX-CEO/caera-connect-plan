-- Rollback for OCADE P28 controlled-rollout gates.
-- Refuses to erase immutable review history. Not applied automatically.
BEGIN;

DROP TRIGGER IF EXISTS feature_flags_enforce_controlled_rollout
  ON public.feature_flags;
DROP FUNCTION IF EXISTS public.enforce_controlled_rollout_stage();
DROP TRIGGER IF EXISTS launch_gate_enforce_controlled_evidence
  ON public.launch_gate_items;
DROP FUNCTION IF EXISTS public.enforce_controlled_rollout_evidence();

DO $$
DECLARE
  controlled_keys constant text[] := ARRAY[
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
  ];
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.launch_gate_history h
    JOIN public.launch_gate_items i ON i.id = h.item_id
    WHERE i.key = ANY(controlled_keys)
  ) THEN
    RAISE EXCEPTION 'Controlled-rollout gate history exists; automatic rollback refuses to erase audit evidence.';
  END IF;
  DELETE FROM public.launch_gate_items WHERE key = ANY(controlled_keys);
END;
$$;

COMMIT;
