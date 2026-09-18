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
DECLARE a uuid; d uuid; lease uuid; pending uuid; r record; payload jsonb;
BEGIN
  SELECT account, laptop INTO a, d FROM usage_authority_probe;
  IF current_user <> 'service_role' OR has_table_privilege(current_user, 'auth.users', 'SELECT') THEN
    RAISE EXCEPTION 'permission proof requires service_role without auth.users access';
  END IF;
  IF has_function_privilege('authenticated', 'public.ocade_cancel_unsigned_offline_usage(uuid,uuid,uuid)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.ocade_cancel_unsigned_offline_usage(uuid,uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'unsigned cancellation must be service-only';
  END IF;
  SELECT lease_id INTO lease FROM public.ocade_allocate_offline_usage(
    a, d, 'probe-laptop', repeat('L',44), 'signing-race', 'free', 2800, NULL, 700, false);
  SELECT * INTO r FROM public.ocade_device_usage_leases WHERE id = lease;
  payload := jsonb_build_object(
    'leaseId', lease, 'accountId', a, 'deviceId', d, 'tier', r.tier,
    'allocatedHundredths', r.allocated_hundredths, 'sequenceStart', r.sequence_start,
    'sequenceEnd', r.sequence_end, 'sessionWindowStart', r.session_window_start,
    'sessionResetAt', r.session_reset_at, 'weekWindowStart', r.week_window_start,
    'weekResetAt', r.week_reset_at, 'issuedAt', r.issued_at, 'notBefore', r.not_before,
    'expiresAt', r.expires_at, 'preissued', r.preissued);
  IF NOT public.ocade_activate_offline_usage_lease(a, lease, 'probe', payload, repeat('S',88))
    OR NOT public.ocade_activate_offline_usage_lease(a, lease, 'probe', payload, repeat('S',88)) THEN
    RAISE EXCEPTION 'same signing retry must succeed idempotently';
  END IF;
  IF public.ocade_activate_offline_usage_lease(a, lease, 'probe', payload, repeat('X',88)) THEN
    RAISE EXCEPTION 'different signature overwrote an active lease';
  END IF;
  IF public.ocade_cancel_unsigned_offline_usage(a, d, lease) <> 0
    OR (SELECT used_hundredths FROM public.ocade_commercial_usage WHERE user_id = a AND window_kind = 'session') <> 700 THEN
    RAISE EXCEPTION 'losing signer refunded another request''s active lease';
  END IF;
  SELECT lease_id INTO pending FROM public.ocade_allocate_offline_usage(
    a, d, 'probe-laptop', repeat('L',44), 'signing-failed', 'free', 2800, NULL, 700, false);
  IF public.ocade_cancel_unsigned_offline_usage(a, gen_random_uuid(), pending) <> 0
    OR public.ocade_cancel_unsigned_offline_usage(a, d, pending) <> 700
    OR public.ocade_cancel_unsigned_offline_usage(a, d, pending) <> 0 THEN
    RAISE EXCEPTION 'unsigned cancellation identity or idempotency broken';
  END IF;
  SELECT * INTO r FROM public.ocade_device_usage_leases WHERE id = pending;
  payload := payload || jsonb_build_object('leaseId', pending, 'sequenceStart', r.sequence_start,
    'sequenceEnd', r.sequence_end, 'issuedAt', r.issued_at, 'notBefore', r.not_before);
  IF public.ocade_activate_offline_usage_lease(a, pending, 'probe', payload, repeat('S',88)) THEN
    RAISE EXCEPTION 'cancelled lease reactivated';
  END IF;
END $$;
RESET ROLE;
ROLLBACK;
