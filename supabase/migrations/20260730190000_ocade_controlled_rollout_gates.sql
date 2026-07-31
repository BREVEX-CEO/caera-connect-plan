-- OCADE P28 controlled-rollout gates.
-- READY TO APPLY through the documented Supabase owner workflow. Not applied by Codex.
BEGIN;

INSERT INTO public.launch_gate_items (key, category, title, description, blocker)
VALUES
  ('alpha_cohort', 'Controlled rollout', 'Internal alpha cohort', 'Pseudonymous cohort roster, consent basis, capability and platform limits, and revocation path are independently reviewed.', true),
  ('alpha_task_library', 'Controlled rollout', 'Alpha task library', 'Representative success, refusal, cancellation, failure and recovery missions have reviewable receipts.', true),
  ('alpha_endurance_recovery', 'Controlled rollout', 'Endurance and crash recovery', 'Long-duration, interruption, crash recovery, emergency-stop and rollback missions meet the approved threshold.', true),
  ('alpha_performance', 'Controlled rollout', 'Alpha performance thresholds', 'Latency, resource, reliability and regression thresholds pass on declared hardware and platforms.', true),
  ('alpha_usability', 'Controlled rollout', 'Alpha usability review', 'Blocking usability failures are resolved and remaining limitations are disclosed.', true),
  ('alpha_security_review', 'Controlled rollout', 'Alpha security review', 'Threat, privacy, permission, isolation and adversarial findings meet the approved threshold.', true),
  ('alpha_exit_review', 'Controlled rollout', 'Alpha exit review', 'A reviewer independent from the rollout owner approves the complete alpha evidence pack.', true),
  ('beta_enrolment', 'Controlled rollout', 'Controlled beta enrolment', 'Invitation, consent, support, revocation, capability and platform limits are documented and tested.', true),
  ('beta_telemetry_consent', 'Controlled rollout', 'Beta telemetry consent', 'Collection remains off by default and only consented allow-listed failure or performance fields leave the device.', true),
  ('beta_coverage_limits', 'Controlled rollout', 'Beta coverage limits', 'Supported capabilities, platforms, versions, exclusions and stop-expansion thresholds are published.', true),
  ('beta_exit_review', 'Controlled rollout', 'Beta exit review', 'Security, reliability, rollback, support and incident thresholds pass independent review before GA.', true)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.enforce_controlled_rollout_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  IF NEW.key = ANY(controlled_keys) THEN
    IF NEW.status = 'waived' THEN
      RAISE EXCEPTION 'Controlled-rollout evidence gate % cannot be waived.', NEW.key
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status = 'complete' AND (
      NEW.evidence_url IS NULL
      OR btrim(NEW.evidence_url) = ''
      OR NEW.owner IS NULL
      OR btrim(NEW.owner) = ''
      OR NEW.reviewer IS NULL
      OR btrim(NEW.reviewer) = ''
      OR lower(btrim(NEW.owner)) = lower(btrim(NEW.reviewer))
    ) THEN
      RAISE EXCEPTION 'Controlled-rollout gate % needs evidence and distinct owner/reviewer identities.', NEW.key
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_controlled_rollout_evidence()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS launch_gate_enforce_controlled_evidence
  ON public.launch_gate_items;
CREATE TRIGGER launch_gate_enforce_controlled_evidence
  BEFORE INSERT OR UPDATE ON public.launch_gate_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_controlled_rollout_evidence();

CREATE OR REPLACE FUNCTION public.enforce_controlled_rollout_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_rank integer := 0;
  new_rank integer;
  required_keys text[];
  unresolved_count integer;
BEGIN
  new_rank := CASE NEW.stage
    WHEN 'demo' THEN 0
    WHEN 'private_alpha' THEN 1
    WHEN 'beta' THEN 2
    WHEN 'ga' THEN 3
  END;
  IF TG_OP = 'UPDATE' THEN
    old_rank := CASE OLD.stage
      WHEN 'demo' THEN 0
      WHEN 'private_alpha' THEN 1
      WHEN 'beta' THEN 2
      WHEN 'ga' THEN 3
    END;
  END IF;

  IF new_rank > old_rank + 1 THEN
    RAISE EXCEPTION 'Feature flag % cannot skip rollout stages from % to %.', NEW.id,
      CASE old_rank WHEN 0 THEN 'demo' WHEN 1 THEN 'private_alpha' WHEN 2 THEN 'beta' ELSE 'ga' END,
      NEW.stage
      USING ERRCODE = 'check_violation';
  END IF;

  IF new_rank < old_rank THEN
    RETURN NEW;
  END IF;

  IF NEW.enabled = true AND NEW.stage <> 'demo' THEN
    IF NOT EXISTS (
      SELECT 1 FROM unnest(NEW.applicable_modules) AS module(value)
      WHERE lower(module.value) LIKE 'capability:%' AND length(module.value) > length('capability:')
    ) OR NOT EXISTS (
      SELECT 1 FROM unnest(NEW.applicable_modules) AS module(value)
      WHERE lower(module.value) LIKE 'platform:%' AND length(module.value) > length('platform:')
    ) THEN
      RAISE EXCEPTION 'Feature flag % needs capability:* and platform:* coverage limits.', NEW.id
        USING ERRCODE = 'check_violation';
    END IF;

    required_keys := ARRAY[
      'privacy_policy',
      'provider_disclosure',
      'secret_management',
      'incident_response'
    ];
    IF NEW.stage IN ('beta', 'ga') THEN
      required_keys := required_keys || ARRAY[
        'alpha_cohort',
        'alpha_task_library',
        'alpha_endurance_recovery',
        'alpha_performance',
        'alpha_usability',
        'alpha_security_review',
        'alpha_exit_review'
      ];
    END IF;
    IF NEW.stage = 'ga' THEN
      required_keys := required_keys || ARRAY[
        'beta_enrolment',
        'beta_telemetry_consent',
        'beta_coverage_limits',
        'beta_exit_review'
      ];
      SELECT required_keys || coalesce(array_agg(i.key), ARRAY[]::text[])
      INTO required_keys
      FROM public.launch_gate_items i
      WHERE i.blocker = true
        AND (
          cardinality(NEW.applicable_modules) = 0
          OR cardinality(i.applicable_modules) = 0
          OR i.applicable_modules && NEW.applicable_modules
        );
    END IF;

    SELECT count(*) INTO unresolved_count
    FROM unnest(required_keys) AS requirement(key)
    LEFT JOIN public.launch_gate_items i ON i.key = requirement.key
    WHERE i.id IS NULL
      OR i.status <> 'complete'
      OR i.evidence_url IS NULL
      OR btrim(i.evidence_url) = ''
      OR i.owner IS NULL
      OR btrim(i.owner) = ''
      OR i.reviewer IS NULL
      OR btrim(i.reviewer) = ''
      OR lower(btrim(i.owner)) = lower(btrim(i.reviewer));

    IF unresolved_count > 0 THEN
      RAISE EXCEPTION 'Feature flag % cannot enter enabled %: % evidence gate(s) unresolved.',
        NEW.id, NEW.stage, unresolved_count
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_controlled_rollout_stage()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS feature_flags_enforce_controlled_rollout
  ON public.feature_flags;
CREATE TRIGGER feature_flags_enforce_controlled_rollout
  BEFORE INSERT OR UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.enforce_controlled_rollout_stage();

COMMIT;
