-- Exercise the durable permit lifecycle through the actual Postgres functions.
DO $$
DECLARE
  probe_user uuid := gen_random_uuid();
  first_id uuid;
  repeated_id uuid;
  result text;
  charged bigint;
  used bigint;
  released boolean;
  usage_rows integer;
  grant_count integer := 0;
  i integer;
BEGIN
  INSERT INTO auth.users (id, email, created_at)
  VALUES (
    probe_user,
    'commercial-permit-probe-' || probe_user || '@invalid.test',
    statement_timestamp() - INTERVAL '1 day'
  );

  SELECT permit_id, outcome INTO first_id, result
    FROM public.ocade_acquire_generation_permit(
      probe_user, 'same-logical-request', 'generation-1', 'chat', 'pro',
      14000, 70000, 25
    );
  IF result <> 'granted' OR first_id IS NULL THEN
    RAISE EXCEPTION 'first permit was not granted: %, %', result, first_id;
  END IF;

  SELECT permit_id, outcome INTO repeated_id, result
    FROM public.ocade_acquire_generation_permit(
      probe_user, 'same-logical-request', 'generation-1', 'chat', 'pro',
      14000, 70000, 25
    );
  IF result <> 'granted' OR repeated_id <> first_id THEN
    RAISE EXCEPTION 'idempotent acquire returned a second permit: %, %, %',
      result, first_id, repeated_id;
  END IF;

  SELECT count(*) INTO usage_rows
    FROM public.ocade_read_commercial_usage(probe_user);
  IF usage_rows <> 2 THEN
    RAISE EXCEPTION 'commercial usage read returned % windows rather than 2', usage_rows;
  END IF;
  SELECT used_hundredths, reserved_hundredths INTO used, charged
    FROM public.ocade_read_commercial_usage(probe_user)
   WHERE window_kind = 'session';
  IF used <> 0 OR charged <> 25 THEN
    RAISE EXCEPTION 'active work was not separated from successful usage: %, %', used, charged;
  END IF;

  SELECT used_hundredths INTO used
    FROM public.ocade_commercial_usage
   WHERE user_id = probe_user AND window_kind = 'session';
  IF used <> 25 THEN
    RAISE EXCEPTION 'idempotent acquire reserved % rather than 25', used;
  END IF;

  SELECT outcome INTO result
    FROM public.ocade_acquire_generation_permit(
      probe_user, 'same-logical-request', 'another-generation', 'code', 'pro',
      14000, 70000, 25
    );
  IF result <> 'idempotency_conflict' THEN
    RAISE EXCEPTION 'a reused key changed identity: %', result;
  END IF;

  SELECT charged_hundredths, outcome INTO charged, result
    FROM public.ocade_finalize_generation_permit(
      probe_user, 'same-logical-request', 400
    );
  IF result <> 'succeeded' OR charged <> 400 THEN
    RAISE EXCEPTION 'finalize returned %, %', result, charged;
  END IF;
  SELECT used_hundredths, reserved_hundredths INTO used, charged
    FROM public.ocade_read_commercial_usage(probe_user)
   WHERE window_kind = 'session';
  IF used <> 400 OR charged <> 0 THEN
    RAISE EXCEPTION 'successful work remained reserved: %, %', used, charged;
  END IF;

  -- Finalization is durable and idempotent after a process restart: calling
  -- the function again reads the row rather than a server Map.
  SELECT charged_hundredths, outcome INTO charged, result
    FROM public.ocade_finalize_generation_permit(
      probe_user, 'same-logical-request', 900
    );
  IF result <> 'succeeded' OR charged <> 400 THEN
    RAISE EXCEPTION 'duplicate finalize changed the charge: %, %', result, charged;
  END IF;

  SELECT outcome INTO result
    FROM public.ocade_acquire_generation_permit(
      probe_user, 'same-logical-request', 'generation-1', 'chat', 'pro',
      14000, 70000, 25
    );
  IF result <> 'duplicate_completed' THEN
    RAISE EXCEPTION 'completed idempotency key could run again: %', result;
  END IF;

  released := public.ocade_release_generation_permit(
    probe_user, 'same-logical-request', 'late_release'
  );
  IF released THEN RAISE EXCEPTION 'a completed permit was released'; END IF;

  -- Free always settles one whole successful use, irrespective of measured
  -- weighted work.
  SELECT permit_id, outcome INTO first_id, result
    FROM public.ocade_acquire_generation_permit(
      probe_user, 'free-request', 'generation-free', 'cowork', 'free',
      2800, NULL, 100
    );
  SELECT charged_hundredths INTO charged
    FROM public.ocade_finalize_generation_permit(
      probe_user, 'free-request', 999999
    );
  IF charged <> 100 THEN RAISE EXCEPTION 'Free settled % rather than 100', charged; END IF;

  -- A pre-output failure returns the reservation exactly once.
  SELECT permit_id, outcome INTO first_id, result
    FROM public.ocade_acquire_generation_permit(
      probe_user, 'released-request', 'generation-release', 'artifact', 'pro',
      14000, 70000, 25
    );
  released := public.ocade_release_generation_permit(
    probe_user, 'released-request', 'cancelled_before_output'
  );
  IF NOT released THEN RAISE EXCEPTION 'first release did not release'; END IF;
  released := public.ocade_release_generation_permit(
    probe_user, 'released-request', 'duplicate'
  );
  IF released THEN RAISE EXCEPTION 'double release released twice'; END IF;

  -- Expiration is also durable.  A later acquisition reclaims a stale hold
  -- before making its own reservation.
  SELECT permit_id, outcome INTO first_id, result
    FROM public.ocade_acquire_generation_permit(
      probe_user, 'stale-request', 'generation-stale', 'voice', 'pro',
      14000, 70000, 25
    );
  UPDATE public.ocade_generation_permits
     SET issued_at = statement_timestamp() - INTERVAL '1 hour',
         expires_at = statement_timestamp() - INTERVAL '1 second'
   WHERE id = first_id;
  SELECT permit_id, outcome INTO repeated_id, result
    FROM public.ocade_acquire_generation_permit(
      probe_user, 'after-expiry', 'generation-after', 'task', 'pro',
      14000, 70000, 25
    );
  IF result <> 'granted' THEN RAISE EXCEPTION 'acquire after expiry failed: %', result; END IF;
  IF (SELECT status FROM public.ocade_generation_permits WHERE id = first_id) <> 'expired' THEN
    RAISE EXCEPTION 'stale permit was not expired';
  END IF;

  -- Saturate the Free account through one hundred independent acquisition
  -- attempts. Exactly twenty-eight may reserve; the remaining seventy-two
  -- must be refused by the same atomic account-row decision.
  DELETE FROM public.ocade_generation_permits WHERE user_id = probe_user;
  DELETE FROM public.ocade_commercial_usage WHERE user_id = probe_user;
  FOR i IN 1..100 LOOP
    SELECT outcome INTO result
      FROM public.ocade_acquire_generation_permit(
        probe_user, 'saturation-' || i, 'saturation-generation-' || i,
        'chat', 'free', 2800, NULL, 100
      );
    IF result = 'granted' THEN grant_count := grant_count + 1; END IF;
  END LOOP;
  IF grant_count <> 28 THEN
    RAISE EXCEPTION 'Free saturation granted % requests rather than 28', grant_count;
  END IF;
  SELECT used_hundredths INTO used
    FROM public.ocade_commercial_usage
   WHERE user_id = probe_user AND window_kind = 'session';
  IF used <> 2800 THEN
    RAISE EXCEPTION 'Free saturation recorded % hundredths rather than 2800', used;
  END IF;

  DELETE FROM public.ocade_generation_permits WHERE user_id = probe_user;
  DELETE FROM public.ocade_commercial_usage WHERE user_id = probe_user;
  DELETE FROM auth.users WHERE id = probe_user;

  IF NOT (
    SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.ocade_generation_permits'::regclass
  ) THEN
    RAISE EXCEPTION 'generation permits do not enforce RLS';
  END IF;

  IF has_table_privilege('authenticated', 'public.ocade_generation_permits', 'SELECT')
     OR has_table_privilege('anon', 'public.ocade_generation_permits', 'SELECT') THEN
    RAISE EXCEPTION 'permit metadata is exposed directly';
  END IF;

  IF has_function_privilege(
      'authenticated',
      'public.ocade_acquire_generation_permit(uuid,text,text,text,text,bigint,bigint,bigint)',
      'EXECUTE'
    ) OR has_function_privilege(
      'anon',
      'public.ocade_finalize_generation_permit(uuid,text,bigint)',
      'EXECUTE'
    ) THEN
    RAISE EXCEPTION 'a browser role can mutate commercial permits';
  END IF;

  IF has_function_privilege(
      'authenticated',
      'public.ocade_read_commercial_usage(uuid)',
      'EXECUTE'
    ) OR has_function_privilege(
      'anon',
      'public.ocade_read_commercial_usage(uuid)',
      'EXECUTE'
    ) THEN
    RAISE EXCEPTION 'a browser role can read internal commercial units';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'ocade_generation_permits'
       AND column_name IN ('prompt', 'messages', 'response', 'content', 'attachment')
  ) THEN
    RAISE EXCEPTION 'permit table contains customer content';
  END IF;
END;
$$;
