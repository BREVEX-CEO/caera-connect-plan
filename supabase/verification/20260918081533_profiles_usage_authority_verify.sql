-- Run unchanged on the migrated database. All fixtures and accounting roll back.
BEGIN;
CREATE TEMP TABLE usage_authority_probe (account uuid, laptop uuid, phone uuid);
INSERT INTO usage_authority_probe VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
GRANT SELECT ON usage_authority_probe TO service_role;
INSERT INTO auth.users (id, email, created_at)
SELECT account, 'usage-authority-' || account || '@invalid.test', statement_timestamp() - interval '1 hour'
FROM usage_authority_probe;
INSERT INTO public.devices (id, user_id, kind, name)
SELECT laptop, account, 'desktop'::public.device_kind, 'Usage regression laptop' FROM usage_authority_probe
UNION ALL SELECT phone, account, 'desktop'::public.device_kind, 'Usage regression phone' FROM usage_authority_probe;
INSERT INTO public.browser_grants (user_id, device_id, browser_install_id, origin, user_agent)
SELECT account, laptop, 'probe-laptop', 'https://ocade.invalid', 'database regression' FROM usage_authority_probe
UNION ALL SELECT account, phone, 'probe-phone', 'https://ocade.invalid', 'database regression' FROM usage_authority_probe;

SET LOCAL ROLE service_role;
DO $$
DECLARE
  a uuid; d uuid; d2 uuid; lease uuid; second_lease uuid; permit uuid;
  result text; amount bigint; used bigint; held bigint; i integer; f record;
BEGIN
  SELECT account, laptop, phone INTO a, d, d2 FROM usage_authority_probe;
  IF current_user <> 'service_role' THEN RAISE EXCEPTION 'runtime proof is not service_role'; END IF;
  IF has_table_privilege(current_user, 'auth.users', 'SELECT')
     OR has_table_privilege(current_user, 'auth.users', 'UPDATE') THEN
    RAISE EXCEPTION 'auth.users access would mask the production defect';
  END IF;
  BEGIN
    PERFORM id FROM auth.users LIMIT 1;
    RAISE EXCEPTION 'auth.users read unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  FOR f IN SELECT p.oid, p.proname, p.prosecdef, p.prosrc FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'ocade_acquire_generation_permit', 'ocade_read_commercial_usage',
      'ocade_finalize_generation_permit', 'ocade_release_generation_permit',
      'ocade_allocate_offline_usage', 'ocade_return_offline_usage',
      'ocade_expire_commercial_permits', 'ocade_activate_offline_usage_lease',
      'ocade_reconcile_offline_usage', 'ocade_read_offline_usage')
  LOOP
    IF f.prosecdef OR f.prosrc ~ 'auth[.]users'
       OR has_function_privilege('anon', f.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', f.oid, 'EXECUTE')
       OR NOT has_function_privilege('service_role', f.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'unsafe usage authority: %', f.proname;
    END IF;
  END LOOP;
  IF has_column_privilege('authenticated', 'public.profiles', 'created_at', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.profiles', 'id', 'UPDATE') THEN
    RAISE EXCEPTION 'account identity or window anchor is user-editable';
  END IF;

  -- Missing accounts fail closed, including offline allocations.
  BEGIN
    PERFORM * FROM public.ocade_read_commercial_usage(gen_random_uuid());
    RAISE EXCEPTION 'unknown account was accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  SELECT outcome, permit_id INTO result, permit FROM public.ocade_acquire_generation_permit(
    a, 'failed-chat', 'failed-chat', 'chat', 'free', 2800, NULL, 100);
  IF result <> 'granted' OR permit IS NULL THEN RAISE EXCEPTION 'chat permit failed'; END IF;
  SELECT outcome INTO result FROM public.ocade_acquire_generation_permit(
    a, 'failed-chat', 'other-generation', 'chat', 'free', 2800, NULL, 100);
  IF result <> 'idempotency_conflict' THEN RAISE EXCEPTION 'conflicting retry accepted'; END IF;
  IF NOT public.ocade_release_generation_permit(a, 'failed-chat', 'failed')
     OR public.ocade_release_generation_permit(a, 'failed-chat', 'failed') THEN
    RAISE EXCEPTION 'failed chat release is not idempotent';
  END IF;
  SELECT used_hundredths, reserved_hundredths INTO used, held
    FROM public.ocade_read_commercial_usage(a) WHERE window_kind = 'session';
  IF used <> 0 OR held <> 0 THEN RAISE EXCEPTION 'failed chat charged allowance'; END IF;

  -- Free is exactly 28 completed requests; retries charge nothing extra.
  FOR i IN 1..28 LOOP
    SELECT outcome INTO result FROM public.ocade_acquire_generation_permit(
      a, 'success-' || i, 'success-' || i, 'chat', 'free', 2800, NULL, 100);
    IF result <> 'granted' THEN RAISE EXCEPTION 'Free request % refused', i; END IF;
    SELECT charged_hundredths, outcome INTO amount, result
      FROM public.ocade_finalize_generation_permit(a, 'success-' || i, 100);
    IF result <> 'succeeded' OR amount <> 100 THEN RAISE EXCEPTION 'wrong Free charge'; END IF;
    PERFORM * FROM public.ocade_finalize_generation_permit(a, 'success-' || i, 100);
  END LOOP;
  SELECT outcome INTO result FROM public.ocade_acquire_generation_permit(
    a, 'success-1', 'success-1', 'chat', 'free', 2800, NULL, 100);
  IF result <> 'duplicate_completed' THEN RAISE EXCEPTION 'completed retry charged twice'; END IF;
  SELECT outcome INTO result FROM public.ocade_acquire_generation_permit(
    a, '29th', '29th', 'chat', 'free', 2800, NULL, 100);
  SELECT used_hundredths, reserved_hundredths INTO used, held
    FROM public.ocade_read_commercial_usage(a) WHERE window_kind = 'session';
  IF result <> 'session_exhausted' OR used <> 2800 OR held <> 0 THEN
    RAISE EXCEPTION 'Free session accounting broken: %, %, %', result, used, held;
  END IF;
  DELETE FROM public.ocade_generation_permits WHERE user_id = a;
  DELETE FROM public.ocade_commercial_usage WHERE user_id = a;

  -- Expired reservations cannot finalize, and release their capacity once.
  PERFORM * FROM public.ocade_acquire_generation_permit(a, 'expired', 'expired', 'chat', 'free', 2800, NULL, 100);
  UPDATE public.ocade_generation_permits SET issued_at = statement_timestamp() - interval '1 hour',
    expires_at = statement_timestamp() - interval '1 minute' WHERE user_id = a;
  SELECT outcome INTO result FROM public.ocade_finalize_generation_permit(a, 'expired', 100);
  IF result <> 'expired' THEN RAISE EXCEPTION 'expired permit finalized'; END IF;

  -- Allocation must reclaim expired online holds without a prior usage read.
  PERFORM * FROM public.ocade_acquire_generation_permit(a, 'stale-online', 'stale-online', 'chat', 'free', 2800, NULL, 2800);
  UPDATE public.ocade_generation_permits SET issued_at = statement_timestamp() - interval '1 hour',
    expires_at = statement_timestamp() - interval '1 minute' WHERE user_id = a AND status = 'reserved';

  -- Both devices and online requests spend one account pool.
  SELECT lease_id, outcome INTO lease, result FROM public.ocade_allocate_offline_usage(
    a, d, 'probe-laptop', repeat('L',44), 'laptop', 'free', 2800, NULL, 700, false);
  IF result <> 'allocated' THEN RAISE EXCEPTION 'offline allocation failed'; END IF;
  SELECT outcome INTO result FROM public.ocade_allocate_offline_usage(
    a, d, 'probe-laptop', repeat('L',44), 'laptop', 'free', 2800, NULL, 700, false);
  IF result <> 'duplicate' THEN RAISE EXCEPTION 'offline retry not idempotent'; END IF;
  SELECT lease_id INTO second_lease FROM public.ocade_allocate_offline_usage(
    a, d2, 'probe-phone', repeat('P',44), 'phone', 'free', 2800, NULL, 2000, false);
  SELECT outcome INTO result FROM public.ocade_acquire_generation_permit(
    a, 'last', 'last', 'chat', 'free', 2800, NULL, 100);
  IF result <> 'granted' THEN RAISE EXCEPTION 'last shared use refused'; END IF;
  SELECT outcome INTO result FROM public.ocade_acquire_generation_permit(
    a, 'over', 'over', 'chat', 'free', 2800, NULL, 100);
  IF result <> 'session_exhausted' THEN RAISE EXCEPTION 'shared allowance overspent'; END IF;

  SELECT * INTO f FROM public.ocade_device_usage_leases WHERE id = lease;
  IF NOT public.ocade_activate_offline_usage_lease(a, lease, 'probe-key', jsonb_build_object(
    'leaseId', lease, 'accountId', a, 'deviceId', d, 'tier', f.tier,
    'allocatedHundredths', f.allocated_hundredths, 'sequenceStart', f.sequence_start,
    'sequenceEnd', f.sequence_end, 'sessionWindowStart', f.session_window_start,
    'sessionResetAt', f.session_reset_at, 'weekWindowStart', f.week_window_start,
    'weekResetAt', f.week_reset_at, 'issuedAt', f.issued_at, 'notBefore', f.not_before,
    'expiresAt', f.expires_at, 'preissued', f.preissued), repeat('S',88)) THEN
    RAISE EXCEPTION 'offline activation failed';
  END IF;
  -- Cryptographic chain validation is server-side; this proves DB permissions and totals.
  PERFORM public.ocade_reconcile_offline_usage(a, d, lease, 100, 1, 'probe-hash', '[]');
  PERFORM public.ocade_reconcile_offline_usage(a, d, lease, 100, 1, 'probe-hash', '[]');
  BEGIN
    PERFORM public.ocade_reconcile_offline_usage(a, d, lease, 800, 2, 'probe-hash', '[]');
    RAISE EXCEPTION 'offline overconsumption accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF public.ocade_return_offline_usage(a, d, lease) <> 600
     OR public.ocade_return_offline_usage(a, d, lease) <> 0 THEN
    RAISE EXCEPTION 'offline return not exact and idempotent';
  END IF;
  IF public.ocade_return_offline_usage(a, d2, second_lease) <> 2000 THEN
    RAISE EXCEPTION 'second device return failed';
  END IF;
  PERFORM public.ocade_release_generation_permit(a, 'last', 'failed');
  SELECT used_hundredths, reserved_hundredths INTO used, held
    FROM public.ocade_read_commercial_usage(a) WHERE window_kind = 'session';
  IF used <> 100 OR held <> 0 THEN RAISE EXCEPTION 'shared reconciliation totals wrong'; END IF;
  IF (SELECT count(*) FROM public.ocade_read_offline_usage(a)) <> 2 THEN
    RAISE EXCEPTION 'account-wide device read failed';
  END IF;
END $$;
RESET ROLE;
ROLLBACK;
