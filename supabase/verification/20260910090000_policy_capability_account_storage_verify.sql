-- Verifies 20260910090000_policy_capability_account_storage.sql.

DO $$
DECLARE
  definition text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO definition
    FROM pg_constraint
   WHERE conrelid = 'public.ocade_organization_policies'::regclass
     AND conname = 'ocade_organization_policies_capabilities';

  IF definition IS NULL THEN
    RAISE EXCEPTION 'the capability vocabulary is no longer constrained, so an unknown capability would be stored and silently ignored';
  END IF;

  IF definition NOT LIKE '%accountStorage%' THEN
    RAISE EXCEPTION 'the policy vocabulary does not know accountStorage, so withholding it would be refused with nothing on screen to explain why';
  END IF;

  IF definition LIKE '%privateSync%' THEN
    RAISE EXCEPTION 'the policy vocabulary still names privateSync, which the product no longer has';
  END IF;
END $$;
