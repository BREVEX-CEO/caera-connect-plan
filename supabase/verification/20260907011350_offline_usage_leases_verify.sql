DO $$
DECLARE
  probe_user uuid := gen_random_uuid();
  other_user uuid := gen_random_uuid();
  probe_device uuid;
  probe_grant uuid;
  lease uuid;
  repeated uuid;
  preissued_lease uuid;
  result text;
  allocated bigint;
  used bigint;
  returned bigint;
  i integer;
  function_name text;
  fake_payload jsonb;
  fake_events jsonb;
  leases uuid[] := ARRAY[]::uuid[];
BEGIN
  INSERT INTO auth.users (id, email, created_at) VALUES
    (probe_user, 'offline-lease-probe-' || probe_user || '@invalid.test', statement_timestamp()),
    (other_user, 'offline-lease-other-' || other_user || '@invalid.test', statement_timestamp());
  INSERT INTO public.devices (user_id, kind, name)
    VALUES (probe_user, 'desktop', 'Offline lease probe') RETURNING id INTO probe_device;
  INSERT INTO public.browser_grants (
    user_id, device_id, browser_install_id, origin, user_agent
  ) VALUES (
    probe_user, probe_device, 'offline-probe-install', 'https://ocade.invalid', 'verification'
  ) RETURNING id INTO probe_grant;

  SELECT lease_id, outcome, allocated_hundredths INTO lease, result, allocated
    FROM public.ocade_allocate_offline_usage(
      probe_user, probe_device, 'offline-probe-install',
      repeat('A', 44), 'allocation-1', 'free', 2800, NULL, 700, false
    );
  IF result <> 'allocated' OR lease IS NULL OR allocated <> 700 THEN
    RAISE EXCEPTION 'initial offline allocation failed: %, %, %', result, lease, allocated;
  END IF;
  leases := array_append(leases, lease);

  SELECT lease_id, outcome, allocated_hundredths INTO repeated, result, allocated
    FROM public.ocade_allocate_offline_usage(
      probe_user, probe_device, 'offline-probe-install',
      repeat('A', 44), 'allocation-1', 'free', 2800, NULL, 700, false
    );
  IF result <> 'duplicate' OR repeated <> lease OR allocated <> 700 THEN
    RAISE EXCEPTION 'allocation retry was not idempotent: %, %, %', result, repeated, allocated;
  END IF;

  fake_payload := jsonb_build_object(
    'version', 1, 'keyId', 'verification-key', 'leaseId', lease::text,
    'accountId', probe_user::text, 'deviceId', probe_device::text,
    'tier', 'free', 'allocatedHundredths', 700,
    'sequenceStart', 1, 'sequenceEnd', 1000000,
    'sessionWindowStart', (SELECT session_window_start FROM public.ocade_device_usage_leases WHERE id = lease),
    'sessionResetAt', (SELECT session_reset_at FROM public.ocade_device_usage_leases WHERE id = lease),
    'weekWindowStart', (SELECT week_window_start FROM public.ocade_device_usage_leases WHERE id = lease),
    'weekResetAt', (SELECT week_reset_at FROM public.ocade_device_usage_leases WHERE id = lease),
    'issuedAt', (SELECT issued_at FROM public.ocade_device_usage_leases WHERE id = lease),
    'notBefore', (SELECT not_before FROM public.ocade_device_usage_leases WHERE id = lease),
    'expiresAt', (SELECT expires_at FROM public.ocade_device_usage_leases WHERE id = lease),
    'preissued', false
  );
  IF NOT public.ocade_activate_offline_usage_lease(
    probe_user, lease, 'verification-key', fake_payload, repeat('S', 88)
  ) THEN
    RAISE EXCEPTION 'signed lease activation failed';
  END IF;

  -- Three independently signed blocks reserve the rest of Free's exact
  -- twenty-eight-use window. A refill never invalidates a usable block.
  FOR i IN 2..4 LOOP
    SELECT lease_id, outcome, allocated_hundredths INTO lease, result, allocated
      FROM public.ocade_allocate_offline_usage(
        probe_user, probe_device, 'offline-probe-install',
        repeat('A', 44), 'allocation-' || i, 'free', 2800, NULL, 700, false
      );
    IF result <> 'allocated' OR allocated <> 700 THEN
      RAISE EXCEPTION 'offline refill % failed: %, %', i, result, allocated;
    END IF;
    leases := array_append(leases, lease);
    fake_payload := jsonb_build_object(
      'version', 1, 'keyId', 'verification-key', 'leaseId', lease::text,
      'accountId', probe_user::text, 'deviceId', probe_device::text,
      'tier', 'free', 'allocatedHundredths', 700,
      'sequenceStart', 1, 'sequenceEnd', 1000000,
      'sessionWindowStart', (SELECT session_window_start FROM public.ocade_device_usage_leases WHERE id = lease),
      'sessionResetAt', (SELECT session_reset_at FROM public.ocade_device_usage_leases WHERE id = lease),
      'weekWindowStart', (SELECT week_window_start FROM public.ocade_device_usage_leases WHERE id = lease),
      'weekResetAt', (SELECT week_reset_at FROM public.ocade_device_usage_leases WHERE id = lease),
      'issuedAt', (SELECT issued_at FROM public.ocade_device_usage_leases WHERE id = lease),
      'notBefore', (SELECT not_before FROM public.ocade_device_usage_leases WHERE id = lease),
      'expiresAt', (SELECT expires_at FROM public.ocade_device_usage_leases WHERE id = lease),
      'preissued', false
    );
    IF NOT public.ocade_activate_offline_usage_lease(
      probe_user, lease, 'verification-key', fake_payload, repeat('S', 88)
    ) THEN RAISE EXCEPTION 'refill lease % did not activate', i; END IF;
  END LOOP;
  SELECT outcome INTO result
    FROM public.ocade_allocate_offline_usage(
      probe_user, probe_device, 'offline-probe-install',
      repeat('A', 44), 'allocation-5', 'free', 2800, NULL, 700, false
    );
  IF result <> 'session_exhausted' THEN
    RAISE EXCEPTION 'offline allocation exceeded Free capacity: %', result;
  END IF;

  SELECT used_hundredths INTO used FROM public.ocade_commercial_usage
   WHERE user_id = probe_user AND window_kind = 'session';
  IF used <> 2800 THEN RAISE EXCEPTION 'offline capacity reserved %, expected 2800', used; END IF;

  fake_events := jsonb_build_array(
    jsonb_build_object(
      'payload', jsonb_build_object(
        'eventId', gen_random_uuid(), 'leaseId', lease::text,
        'accountId', probe_user::text, 'deviceId', probe_device::text,
        'sequence', 1, 'generationId', 'offline-generation-1',
        'idempotencyKey', 'offline-request-1', 'surface', 'chat',
        'status', 'reserved', 'costHundredths', 100,
        'occurredAt', statement_timestamp(), 'previousHash', ''
      ), 'eventHash', 'event-hash-1', 'deviceSignature', repeat('D', 88)
    ),
    jsonb_build_object(
      'payload', jsonb_build_object(
        'eventId', gen_random_uuid(), 'leaseId', lease::text,
        'accountId', probe_user::text, 'deviceId', probe_device::text,
        'sequence', 2, 'generationId', 'offline-generation-1',
        'idempotencyKey', 'offline-request-1', 'surface', 'chat',
        'status', 'succeeded', 'costHundredths', 100,
        'occurredAt', statement_timestamp(), 'previousHash', 'event-hash-1'
      ), 'eventHash', 'event-hash-2', 'deviceSignature', repeat('D', 88)
    )
  );
  used := public.ocade_reconcile_offline_usage(
    probe_user, probe_device, lease, 100, 2, 'event-hash-2', fake_events
  );
  IF used <> 100 THEN RAISE EXCEPTION 'offline reconciliation stored %', used; END IF;
  -- Replaying the same verified batch cannot create a second event or charge.
  used := public.ocade_reconcile_offline_usage(
    probe_user, probe_device, lease, 100, 2, 'event-hash-2', fake_events
  );
  IF (SELECT count(*) FROM public.ocade_offline_usage_events WHERE lease_id = lease) <> 2 THEN
    RAISE EXCEPTION 'offline event replay inserted duplicates';
  END IF;
  BEGIN
    PERFORM public.ocade_reconcile_offline_usage(
      probe_user, probe_device, lease, 100, 2, 'event-hash-2',
      jsonb_set(fake_events, '{0,eventHash}', '"forked-event-hash"'::jsonb)
    );
    RAISE EXCEPTION 'a conflicting signed-event sequence was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  returned := public.ocade_return_offline_usage(probe_user, probe_device, lease);
  IF returned <> 600 THEN RAISE EXCEPTION 'unused return was %, expected 600', returned; END IF;
  FOR i IN 1..3 LOOP
    returned := returned + public.ocade_return_offline_usage(probe_user, probe_device, leases[i]);
  END LOOP;
  IF returned <> 2700 THEN RAISE EXCEPTION 'total unused return was %, expected 2700', returned; END IF;
  SELECT used_hundredths INTO used FROM public.ocade_commercial_usage
   WHERE user_id = probe_user AND window_kind = 'session';
  IF used <> 100 THEN RAISE EXCEPTION 'unused return left % rather than 100', used; END IF;
  IF public.ocade_return_offline_usage(probe_user, probe_device, lease) <> 0 THEN
    RAISE EXCEPTION 'offline allocation was returned twice';
  END IF;

  SELECT lease_id, outcome INTO preissued_lease, result
    FROM public.ocade_allocate_offline_usage(
      probe_user, probe_device, 'offline-probe-install', repeat('A', 44),
      'next-window-1', 'free', 2800, NULL, 700, true
    );
  IF result <> 'allocated' OR preissued_lease IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.ocade_device_usage_leases
     WHERE id = preissued_lease AND preissued AND not_before > statement_timestamp()
  ) THEN RAISE EXCEPTION 'next-window block was not preissued'; END IF;
  SELECT lease_id, outcome INTO repeated, result
    FROM public.ocade_allocate_offline_usage(
      probe_user, probe_device, 'offline-probe-install', repeat('A', 44),
      'next-window-2', 'free', 2800, NULL, 700, true
    );
  IF result <> 'duplicate' OR repeated <> preissued_lease THEN
    RAISE EXCEPTION 'a second next-window block was issued: %, %', result, repeated;
  END IF;

  BEGIN
    PERFORM public.ocade_allocate_offline_usage(
      other_user, probe_device, 'offline-probe-install', repeat('A', 44),
      'wrong-account', 'free', 2800, NULL, 700, false
    );
    RAISE EXCEPTION 'another account allocated this device';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.ocade_allocate_offline_usage(
      probe_user, probe_device, 'wrong-install', repeat('A', 44),
      'wrong-install-request', 'free', 2800, NULL, 700, false
    );
    RAISE EXCEPTION 'an unregistered browser allocated this device';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  IF NOT EXISTS (
    SELECT 1 FROM public.ocade_read_offline_usage(probe_user) WHERE lease_id = lease
  ) THEN RAISE EXCEPTION 'offline usage read omitted the device lease'; END IF;

  FOREACH function_name IN ARRAY ARRAY[
    'ocade_allocate_offline_usage(uuid,uuid,text,text,text,text,bigint,bigint,bigint,boolean)',
    'ocade_activate_offline_usage_lease(uuid,uuid,text,jsonb,text)',
    'ocade_reconcile_offline_usage(uuid,uuid,uuid,bigint,bigint,text,jsonb)',
    'ocade_return_offline_usage(uuid,uuid,uuid)',
    'ocade_read_offline_usage(uuid)'
  ] LOOP
    IF has_function_privilege('authenticated', 'public.' || function_name, 'EXECUTE')
       OR has_function_privilege('anon', 'public.' || function_name, 'EXECUTE') THEN
      RAISE EXCEPTION 'browser role can execute %', function_name;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('ocade_device_usage_leases', 'ocade_offline_usage_events')
       AND column_name IN ('prompt', 'messages', 'response', 'content', 'attachment')
  ) THEN RAISE EXCEPTION 'offline usage tables contain customer content'; END IF;

  DELETE FROM public.ocade_offline_usage_events WHERE user_id = probe_user;
  DELETE FROM public.ocade_offline_usage_allocations WHERE user_id = probe_user;
  DELETE FROM public.ocade_device_usage_leases WHERE user_id = probe_user;
  DELETE FROM public.ocade_device_usage_keys WHERE user_id = probe_user;
  DELETE FROM public.ocade_commercial_usage WHERE user_id = probe_user;
  DELETE FROM public.browser_grants WHERE id = probe_grant;
  DELETE FROM public.devices WHERE id = probe_device;
  DELETE FROM auth.users WHERE id IN (probe_user, other_user);
END;
$$;
