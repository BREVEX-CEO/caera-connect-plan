-- Prove the constraints accept the current catalogue AND the archived one, and
-- reject anything else.
--
-- ASSERTED BY ATTEMPTING WRITES, not by reading the constraint text: a
-- definition that looks right and does not hold is exactly the failure being
-- guarded against, and only a write can tell the difference.
--
-- THE TRICK THAT MAKES THAT POSSIBLE WITHOUT INVENTING A USER. `user_id` is a
-- foreign key into the auth schema, and a verification script must not create
-- an account. But PostgreSQL evaluates a CHECK constraint while forming the row
-- and the foreign key afterwards, so the two failures are distinguishable:
--
--   check_violation       -> the plan id was REJECTED by the catalogue check
--   foreign_key_violation -> the plan id was ACCEPTED, and only the fake user
--                            stopped the insert
--
-- So a foreign-key error is the success signal here, and every attempt is
-- rolled back to its savepoint regardless.

DO $$
DECLARE
  probe_user uuid := gen_random_uuid();
  plan_id_probe text;
  outcome text;
BEGIN
  -- The stamp exists on all three billing tables.
  IF (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('ocade_subscriptions', 'ocade_payment_events', 'ocade_invoices')
      AND column_name = 'catalogue_version'
  ) <> 3 THEN
    RAISE EXCEPTION 'catalogue_version is missing from one of the billing tables.';
  END IF;

  -- Every current plan, and every archived one, must pass the check.
  FOREACH plan_id_probe IN ARRAY ARRAY[
    'free', 'pro_weekly', 'pro_monthly', 'max_weekly', 'max_monthly',
    'demo', 'trial_2d', 'std_8d', 'month_1m', 'year_1y'
  ] LOOP
    BEGIN
      INSERT INTO public.ocade_subscriptions (user_id, plan_id, started_at, expires_at, status)
      VALUES (probe_user, plan_id_probe, now(), now() + interval '7 days', 'active');
      outcome := 'inserted';
    EXCEPTION
      WHEN check_violation THEN outcome := 'rejected_by_check';
      WHEN foreign_key_violation THEN outcome := 'passed_check';
    END;

    IF outcome = 'rejected_by_check' THEN
      RAISE EXCEPTION 'ocade_subscriptions rejects the plan id %, which it must accept.',
        plan_id_probe;
    END IF;

    -- If the probe user somehow existed, undo the row rather than leave it.
    IF outcome = 'inserted' THEN
      DELETE FROM public.ocade_subscriptions WHERE user_id = probe_user;
    END IF;
  END LOOP;

  -- An id belonging to neither catalogue is refused by the CHECK, before the
  -- foreign key is ever consulted.
  BEGIN
    INSERT INTO public.ocade_subscriptions (user_id, plan_id, started_at, expires_at, status)
    VALUES (probe_user, 'enterprise_unlimited', now(), now() + interval '7 days', 'active');
    outcome := 'inserted';
  EXCEPTION
    WHEN check_violation THEN outcome := 'rejected_by_check';
    WHEN foreign_key_violation THEN outcome := 'passed_check';
  END;
  IF outcome <> 'rejected_by_check' THEN
    RAISE EXCEPTION 'ocade_subscriptions accepted a plan id from no catalogue (%).', outcome;
  END IF;
  IF outcome = 'inserted' THEN
    DELETE FROM public.ocade_subscriptions WHERE user_id = probe_user;
  END IF;

  -- Rows written before versioning say so, rather than claiming a catalogue
  -- they were not priced under.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ocade_subscriptions'
      AND column_name = 'catalogue_version' AND column_default LIKE '%legacy%'
  ) THEN
    RAISE EXCEPTION 'catalogue_version must default to legacy for pre-versioning rows.';
  END IF;
END;
$$;
