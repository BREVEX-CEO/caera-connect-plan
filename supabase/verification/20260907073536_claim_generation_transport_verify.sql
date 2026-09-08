-- Prove one transport claim per reservation, safe reuse after release, and
-- least-privilege RPC grants. The probe deletes its own temporary account.
DO $$
DECLARE
  probe_user uuid := gen_random_uuid();
  probe_permit uuid;
  first_claim boolean;
  replay_claim boolean;
  released boolean;
BEGIN
  INSERT INTO auth.users (id, email, created_at)
  VALUES (
    probe_user,
    'transport-claim-probe-' || probe_user || '@invalid.test',
    statement_timestamp()
  );

  SELECT permit_id INTO probe_permit
    FROM public.ocade_acquire_generation_permit(
      probe_user,
      'transport-idempotency',
      'transport-generation',
      'cowork',
      'free',
      100,
      NULL,
      100
    );

  first_claim := public.ocade_claim_generation_transport(
    probe_user,
    probe_permit,
    'transport-generation',
    'transport-idempotency',
    'cowork'
  );
  replay_claim := public.ocade_claim_generation_transport(
    probe_user,
    probe_permit,
    'transport-generation',
    'transport-idempotency',
    'cowork'
  );

  IF NOT first_claim OR replay_claim THEN
    RAISE EXCEPTION 'transport permit was not claimed exactly once: %, %',
      first_claim, replay_claim;
  END IF;

  IF public.ocade_claim_generation_transport(
    probe_user,
    probe_permit,
    'wrong-generation',
    'transport-idempotency',
    'cowork'
  ) THEN
    RAISE EXCEPTION 'mismatched transport identity was accepted';
  END IF;

  released := public.ocade_release_generation_permit(
    probe_user,
    'transport-idempotency',
    'verification_retry'
  );
  IF NOT released THEN
    RAISE EXCEPTION 'claimed permit could not be released';
  END IF;

  SELECT permit_id INTO probe_permit
    FROM public.ocade_acquire_generation_permit(
      probe_user,
      'transport-idempotency',
      'transport-generation',
      'cowork',
      'free',
      100,
      NULL,
      100
    );
  IF NOT public.ocade_claim_generation_transport(
    probe_user,
    probe_permit,
    'transport-generation',
    'transport-idempotency',
    'cowork'
  ) THEN
    RAISE EXCEPTION 'a new reservation retained the old transport claim';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.ocade_claim_generation_transport(uuid,uuid,text,text,text)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.ocade_claim_generation_transport(uuid,uuid,text,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'transport claim is exposed to browser roles';
  END IF;

  IF NOT has_function_privilege(
    'service_role',
    'public.ocade_claim_generation_transport(uuid,uuid,text,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'transport claim is unavailable to the server role';
  END IF;

  DELETE FROM public.ocade_generation_permits WHERE user_id = probe_user;
  DELETE FROM auth.users WHERE id = probe_user;
END;
$$;
