-- Signed, device-bound offline allocations drawn from the existing account
-- commercial windows. Allocation reserves capacity up front, so connected
-- permits plus every active offline block can never exceed the plan.

BEGIN;

CREATE TABLE public.ocade_device_usage_keys (
  device_id uuid PRIMARY KEY REFERENCES public.devices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  algorithm text NOT NULL DEFAULT 'Ed25519',
  public_key_base64 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  revoked_at timestamptz,
  CONSTRAINT ocade_device_usage_keys_algorithm_check CHECK (algorithm = 'Ed25519'),
  CONSTRAINT ocade_device_usage_keys_public_key_check
    CHECK (length(public_key_base64) BETWEEN 40 AND 60),
  CONSTRAINT ocade_device_usage_keys_user_device_unique UNIQUE (user_id, device_id)
);

CREATE TABLE public.ocade_device_usage_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  tier text NOT NULL,
  status text NOT NULL,
  allocated_hundredths bigint NOT NULL,
  consumed_hundredths bigint NOT NULL DEFAULT 0,
  sequence_start bigint NOT NULL DEFAULT 1,
  sequence_end bigint NOT NULL DEFAULT 1000000,
  last_sequence bigint NOT NULL DEFAULT 0,
  last_event_hash text NOT NULL DEFAULT '',
  session_window_start timestamptz NOT NULL,
  session_reset_at timestamptz NOT NULL,
  week_window_start timestamptz NOT NULL,
  week_reset_at timestamptz NOT NULL,
  preissued boolean NOT NULL DEFAULT false,
  issued_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  not_before timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  key_id text,
  lease_version integer NOT NULL DEFAULT 1,
  signed_payload jsonb,
  server_signature text,
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT ocade_device_usage_leases_tier_check CHECK (tier IN ('free', 'pro', 'max')),
  CONSTRAINT ocade_device_usage_leases_status_check
    CHECK (status IN ('pending_signature', 'active', 'preissued', 'returned', 'expired')),
  CONSTRAINT ocade_device_usage_leases_allocation_check
    CHECK (allocated_hundredths > 0 AND consumed_hundredths BETWEEN 0 AND allocated_hundredths),
  CONSTRAINT ocade_device_usage_leases_sequence_check
    CHECK (
      sequence_start >= 1 AND sequence_end >= sequence_start
      AND last_sequence BETWEEN sequence_start - 1 AND sequence_end
    ),
  CONSTRAINT ocade_device_usage_leases_time_check
    CHECK (
      session_reset_at > session_window_start
      AND week_reset_at > week_window_start
      AND expires_at = session_reset_at
      AND not_before = session_window_start
    ),
  CONSTRAINT ocade_device_usage_leases_signature_shape_check
    CHECK (
      (status = 'pending_signature'
       AND key_id IS NULL AND signed_payload IS NULL AND server_signature IS NULL)
      OR (status IN ('active', 'preissued') AND key_id IS NOT NULL
          AND signed_payload IS NOT NULL AND server_signature IS NOT NULL)
      OR (status IN ('returned', 'expired') AND (
        (key_id IS NULL AND signed_payload IS NULL AND server_signature IS NULL)
        OR (key_id IS NOT NULL AND signed_payload IS NOT NULL AND server_signature IS NOT NULL)
      ))
    )
);

CREATE TABLE public.ocade_offline_usage_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  lease_id uuid NOT NULL REFERENCES public.ocade_device_usage_leases(id) ON DELETE CASCADE,
  request_key text NOT NULL,
  amount_hundredths bigint NOT NULL CHECK (amount_hundredths > 0),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT ocade_offline_usage_allocations_request_unique UNIQUE (user_id, request_key)
);

CREATE TABLE public.ocade_offline_usage_events (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  lease_id uuid NOT NULL REFERENCES public.ocade_device_usage_leases(id) ON DELETE CASCADE,
  sequence bigint NOT NULL,
  generation_id text NOT NULL,
  idempotency_key text NOT NULL,
  surface text NOT NULL,
  status text NOT NULL,
  cost_hundredths bigint NOT NULL,
  occurred_at timestamptz NOT NULL,
  previous_hash text NOT NULL,
  event_hash text NOT NULL,
  device_signature text NOT NULL,
  reconciled_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT ocade_offline_usage_events_surface_check CHECK (surface IN (
    'chat', 'cowork', 'code', 'task', 'automation',
    'background_agent', 'voice', 'artifact'
  )),
  CONSTRAINT ocade_offline_usage_events_status_check
    CHECK (status IN ('reserved', 'succeeded', 'released')),
  CONSTRAINT ocade_offline_usage_events_cost_check CHECK (cost_hundredths >= 0),
  CONSTRAINT ocade_offline_usage_events_sequence_unique UNIQUE (lease_id, sequence),
  CONSTRAINT ocade_offline_usage_events_event_unique UNIQUE (lease_id, id),
  CONSTRAINT ocade_offline_usage_events_idempotency_status_unique
    UNIQUE (lease_id, idempotency_key, status)
);

CREATE INDEX ocade_device_usage_leases_active_idx
  ON public.ocade_device_usage_leases (user_id, device_id, expires_at)
  WHERE status IN ('active', 'preissued', 'pending_signature');
CREATE UNIQUE INDEX ocade_device_usage_leases_one_preissue_idx
  ON public.ocade_device_usage_leases (user_id, device_id, session_window_start)
  WHERE preissued AND status IN ('pending_signature', 'preissued');
CREATE INDEX ocade_offline_usage_events_reconcile_idx
  ON public.ocade_offline_usage_events (lease_id, sequence);

ALTER TABLE public.ocade_device_usage_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocade_device_usage_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocade_offline_usage_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocade_offline_usage_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ocade_device_usage_keys FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ocade_device_usage_leases FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ocade_offline_usage_allocations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ocade_offline_usage_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ocade_device_usage_keys TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ocade_device_usage_leases TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ocade_offline_usage_allocations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ocade_offline_usage_events TO service_role;

CREATE OR REPLACE FUNCTION public.ocade_expire_offline_usage_leases(
  p_user_id uuid,
  p_now timestamptz DEFAULT statement_timestamp()
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_changed integer;
BEGIN
  UPDATE public.ocade_device_usage_leases AS l
     SET status = 'active', updated_at = p_now
   WHERE l.user_id = p_user_id AND l.status = 'preissued'
     AND l.not_before <= p_now AND l.expires_at > p_now;
  UPDATE public.ocade_device_usage_leases AS l
     SET status = 'expired', updated_at = p_now
   WHERE l.user_id = p_user_id
     AND l.status IN ('active', 'preissued', 'pending_signature')
     AND l.expires_at <= p_now;
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  RETURN v_changed;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_allocate_offline_usage(
  p_user_id uuid,
  p_device_id uuid,
  p_browser_install_id text,
  p_device_public_key text,
  p_request_key text,
  p_tier text,
  p_session_limit_hundredths bigint,
  p_week_limit_hundredths bigint,
  p_amount_hundredths bigint,
  p_preissue boolean DEFAULT false
)
RETURNS TABLE (
  lease_id uuid,
  outcome text,
  tier text,
  allocated_hundredths bigint,
  consumed_hundredths bigint,
  sequence_start bigint,
  sequence_end bigint,
  session_window_start timestamptz,
  session_reset_at timestamptz,
  week_window_start timestamptz,
  week_reset_at timestamptz,
  issued_at timestamptz,
  not_before timestamptz,
  expires_at timestamptz,
  preissued boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_now timestamptz := statement_timestamp();
  v_anchor timestamptz;
  v_target timestamptz;
  v_elapsed numeric;
  v_session_start timestamptz;
  v_session_reset timestamptz;
  v_week_start timestamptz;
  v_week_reset timestamptz;
  v_lease public.ocade_device_usage_leases%ROWTYPE;
  v_allocation public.ocade_offline_usage_allocations%ROWTYPE;
BEGIN
  IF p_tier NOT IN ('free', 'pro', 'max')
     OR p_session_limit_hundredths <= 0
     OR (p_week_limit_hundredths IS NOT NULL AND p_week_limit_hundredths <= 0)
     OR p_amount_hundredths <= 0
     OR length(btrim(p_request_key)) NOT BETWEEN 1 AND 200
     OR length(btrim(p_browser_install_id)) NOT BETWEEN 1 AND 200
     OR length(btrim(p_device_public_key)) NOT BETWEEN 40 AND 60
  THEN
    RAISE EXCEPTION 'invalid offline allocation request' USING ERRCODE = 'check_violation';
  END IF;

  SELECT u.created_at INTO v_anchor
    FROM auth.users AS u WHERE u.id = p_user_id FOR UPDATE;
  IF v_anchor IS NULL THEN
    RAISE EXCEPTION 'unknown offline usage account' USING ERRCODE = 'foreign_key_violation';
  END IF;

  PERFORM 1
    FROM public.devices AS d
    JOIN public.browser_grants AS b
      ON b.device_id = d.id AND b.user_id = d.user_id
   WHERE d.id = p_device_id AND d.user_id = p_user_id
     AND d.revoked_at IS NULL AND b.revoked_at IS NULL
     AND b.browser_install_id = btrim(p_browser_install_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'device or browser grant is not active for this account'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.ocade_device_usage_keys (
    device_id, user_id, algorithm, public_key_base64
  ) VALUES (
    p_device_id, p_user_id, 'Ed25519', btrim(p_device_public_key)
  )
  ON CONFLICT (device_id) DO NOTHING;
  PERFORM 1 FROM public.ocade_device_usage_keys AS k
   WHERE k.device_id = p_device_id AND k.user_id = p_user_id
     AND k.revoked_at IS NULL AND k.public_key_base64 = btrim(p_device_public_key);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'device offline-usage key does not match its registered key'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM public.ocade_expire_offline_usage_leases(p_user_id, v_now);
  SELECT a.* INTO v_allocation
    FROM public.ocade_offline_usage_allocations AS a
   WHERE a.user_id = p_user_id AND a.request_key = btrim(p_request_key);
  IF FOUND THEN
    SELECT l.* INTO v_lease FROM public.ocade_device_usage_leases AS l
     WHERE l.id = v_allocation.lease_id;
    RETURN QUERY SELECT v_lease.id, 'duplicate'::text, v_lease.tier,
      v_lease.allocated_hundredths, v_lease.consumed_hundredths,
      v_lease.sequence_start, v_lease.sequence_end,
      v_lease.session_window_start, v_lease.session_reset_at,
      v_lease.week_window_start, v_lease.week_reset_at,
      v_lease.issued_at, v_lease.not_before, v_lease.expires_at,
      (v_lease.not_before > v_now);
    RETURN;
  END IF;

  v_elapsed := GREATEST(0, EXTRACT(epoch FROM (v_now - v_anchor)));
  v_session_start := v_anchor + FLOOR(v_elapsed / 23280) * INTERVAL '23280 seconds';
  IF p_preissue THEN v_session_start := v_session_start + INTERVAL '388 minutes'; END IF;
  v_session_reset := v_session_start + INTERVAL '388 minutes';
  v_target := v_session_start + INTERVAL '1 second';
  v_elapsed := GREATEST(0, EXTRACT(epoch FROM (v_target - v_anchor)));
  v_week_start := v_anchor + FLOOR(v_elapsed / 604800) * INTERVAL '604800 seconds';
  v_week_reset := v_week_start + INTERVAL '7 days';

  IF p_preissue THEN
    SELECT l.* INTO v_lease
      FROM public.ocade_device_usage_leases AS l
     WHERE l.user_id = p_user_id AND l.device_id = p_device_id
       AND l.session_window_start = v_session_start AND l.preissued
       AND l.status IN ('pending_signature', 'preissued')
     FOR UPDATE;
    IF FOUND THEN
      RETURN QUERY SELECT v_lease.id, 'duplicate'::text, v_lease.tier,
        v_lease.allocated_hundredths, v_lease.consumed_hundredths,
        v_lease.sequence_start, v_lease.sequence_end,
        v_lease.session_window_start, v_lease.session_reset_at,
        v_lease.week_window_start, v_lease.week_reset_at,
        v_lease.issued_at, v_lease.not_before, v_lease.expires_at, true;
      RETURN;
    END IF;
  END IF;

  BEGIN
    PERFORM public.ocade_consume_commercial_work(
      p_user_id, 'session', v_session_start, p_amount_hundredths,
      p_session_limit_hundredths
    );
  EXCEPTION WHEN check_violation THEN
    RETURN QUERY SELECT NULL::uuid, 'session_exhausted'::text, p_tier,
      0::bigint, 0::bigint, 1::bigint, 1000000::bigint,
      v_session_start, v_session_reset, v_week_start, v_week_reset,
      v_now, v_session_start, v_session_reset, p_preissue;
    RETURN;
  END;
  IF p_week_limit_hundredths IS NOT NULL THEN
    BEGIN
      PERFORM public.ocade_consume_commercial_work(
        p_user_id, 'week', v_week_start, p_amount_hundredths,
        p_week_limit_hundredths
      );
    EXCEPTION WHEN check_violation THEN
      PERFORM public.ocade_release_commercial_work(
        p_user_id, 'session', v_session_start, p_amount_hundredths
      );
      RETURN QUERY SELECT NULL::uuid, 'week_exhausted'::text, p_tier,
        0::bigint, 0::bigint, 1::bigint, 1000000::bigint,
        v_session_start, v_session_reset, v_week_start, v_week_reset,
        v_now, v_session_start, v_session_reset, p_preissue;
      RETURN;
    END;
  END IF;

  -- Every allocation is an independently signed block. A refill never mutates
  -- an already usable lease, so a signing outage cannot invalidate or release
  -- capacity the device already owns.
  INSERT INTO public.ocade_device_usage_leases (
    user_id, device_id, tier, status, allocated_hundredths,
    session_window_start, session_reset_at, week_window_start, week_reset_at,
    issued_at, not_before, expires_at, preissued
  ) VALUES (
    p_user_id, p_device_id, p_tier, 'pending_signature', p_amount_hundredths,
    v_session_start, v_session_reset, v_week_start, v_week_reset,
    v_now, v_session_start, v_session_reset, p_preissue
  ) RETURNING * INTO v_lease;

  INSERT INTO public.ocade_offline_usage_allocations (
    user_id, device_id, lease_id, request_key, amount_hundredths
  ) VALUES (
    p_user_id, p_device_id, v_lease.id, btrim(p_request_key), p_amount_hundredths
  );

  RETURN QUERY SELECT v_lease.id, 'allocated'::text, v_lease.tier,
    v_lease.allocated_hundredths, v_lease.consumed_hundredths,
    v_lease.sequence_start, v_lease.sequence_end,
    v_lease.session_window_start, v_lease.session_reset_at,
    v_lease.week_window_start, v_lease.week_reset_at,
    v_lease.issued_at, v_lease.not_before, v_lease.expires_at, v_lease.preissued;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_activate_offline_usage_lease(
  p_user_id uuid,
  p_lease_id uuid,
  p_key_id text,
  p_signed_payload jsonb,
  p_server_signature text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE v_now timestamptz := statement_timestamp();
BEGIN
  UPDATE public.ocade_device_usage_leases AS l
     SET key_id = btrim(p_key_id), signed_payload = p_signed_payload,
         server_signature = btrim(p_server_signature),
         status = CASE WHEN l.preissued THEN 'preissued' ELSE 'active' END,
         updated_at = v_now
   WHERE l.id = p_lease_id AND l.user_id = p_user_id
     AND l.status = 'pending_signature'
     AND (p_signed_payload ->> 'leaseId') = l.id::text
     AND (p_signed_payload ->> 'accountId') = l.user_id::text
     AND (p_signed_payload ->> 'deviceId') = l.device_id::text
     AND (p_signed_payload ->> 'tier') = l.tier
     AND (p_signed_payload ->> 'allocatedHundredths')::bigint = l.allocated_hundredths
     AND (p_signed_payload ->> 'sequenceStart')::bigint = l.sequence_start
     AND (p_signed_payload ->> 'sequenceEnd')::bigint = l.sequence_end
     AND (p_signed_payload ->> 'sessionWindowStart')::timestamptz = l.session_window_start
     AND (p_signed_payload ->> 'sessionResetAt')::timestamptz = l.session_reset_at
     AND (p_signed_payload ->> 'weekWindowStart')::timestamptz = l.week_window_start
     AND (p_signed_payload ->> 'weekResetAt')::timestamptz = l.week_reset_at
     AND (p_signed_payload ->> 'issuedAt')::timestamptz = l.issued_at
     AND (p_signed_payload ->> 'notBefore')::timestamptz = l.not_before
     AND (p_signed_payload ->> 'expiresAt')::timestamptz = l.expires_at
     AND (p_signed_payload ->> 'preissued')::boolean = l.preissued
     AND length(btrim(p_key_id)) BETWEEN 1 AND 120
     AND length(btrim(p_server_signature)) BETWEEN 80 AND 100;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_reconcile_offline_usage(
  p_user_id uuid,
  p_device_id uuid,
  p_lease_id uuid,
  p_consumed_hundredths bigint,
  p_last_sequence bigint,
  p_last_event_hash text,
  p_events jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_lease public.ocade_device_usage_leases%ROWTYPE;
  v_event jsonb;
BEGIN
  SELECT l.* INTO v_lease FROM public.ocade_device_usage_leases AS l
   WHERE l.id = p_lease_id AND l.user_id = p_user_id AND l.device_id = p_device_id
   FOR UPDATE;
  IF NOT FOUND OR v_lease.status NOT IN ('active', 'preissued', 'expired') THEN
    RAISE EXCEPTION 'offline lease cannot be reconciled' USING ERRCODE = 'check_violation';
  END IF;
  IF p_consumed_hundredths < v_lease.consumed_hundredths
     OR p_consumed_hundredths > v_lease.allocated_hundredths
     OR p_last_sequence < v_lease.last_sequence
     OR p_last_sequence > v_lease.sequence_end
     OR jsonb_typeof(p_events) <> 'array'
  THEN
    RAISE EXCEPTION 'invalid offline reconciliation totals' USING ERRCODE = 'check_violation';
  END IF;

  FOR v_event IN SELECT value FROM jsonb_array_elements(p_events)
  LOOP
    IF (v_event -> 'payload' ->> 'leaseId') <> p_lease_id::text
       OR (v_event -> 'payload' ->> 'accountId') <> p_user_id::text
       OR (v_event -> 'payload' ->> 'deviceId') <> p_device_id::text
    THEN
      RAISE EXCEPTION 'offline event identity mismatch' USING ERRCODE = 'check_violation';
    END IF;
    INSERT INTO public.ocade_offline_usage_events (
      id, user_id, device_id, lease_id, sequence, generation_id,
      idempotency_key, surface, status, cost_hundredths, occurred_at,
      previous_hash, event_hash, device_signature
    ) VALUES (
      (v_event -> 'payload' ->> 'eventId')::uuid, p_user_id, p_device_id, p_lease_id,
      (v_event -> 'payload' ->> 'sequence')::bigint,
      v_event -> 'payload' ->> 'generationId',
      v_event -> 'payload' ->> 'idempotencyKey',
      v_event -> 'payload' ->> 'surface',
      v_event -> 'payload' ->> 'status',
      (v_event -> 'payload' ->> 'costHundredths')::bigint,
      (v_event -> 'payload' ->> 'occurredAt')::timestamptz,
      v_event -> 'payload' ->> 'previousHash',
      v_event ->> 'eventHash', v_event ->> 'deviceSignature'
    ) ON CONFLICT (lease_id, sequence) DO NOTHING;
    IF NOT EXISTS (
      SELECT 1 FROM public.ocade_offline_usage_events AS stored
       WHERE stored.lease_id = p_lease_id
         AND stored.sequence = (v_event -> 'payload' ->> 'sequence')::bigint
         AND stored.id = (v_event -> 'payload' ->> 'eventId')::uuid
         AND stored.event_hash = (v_event ->> 'eventHash')
         AND stored.device_signature = (v_event ->> 'deviceSignature')
    ) THEN
      RAISE EXCEPTION 'offline event conflicts with an already reconciled sequence'
        USING ERRCODE = 'unique_violation';
    END IF;
  END LOOP;

  UPDATE public.ocade_device_usage_leases AS l
     SET consumed_hundredths = p_consumed_hundredths,
         last_sequence = p_last_sequence, last_event_hash = p_last_event_hash,
         updated_at = statement_timestamp()
   WHERE l.id = p_lease_id;
  RETURN p_consumed_hundredths;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_return_offline_usage(
  p_user_id uuid,
  p_device_id uuid,
  p_lease_id uuid
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_lease public.ocade_device_usage_leases%ROWTYPE;
  v_unused bigint;
  v_now timestamptz := statement_timestamp();
BEGIN
  PERFORM u.id FROM auth.users AS u WHERE u.id = p_user_id FOR UPDATE;
  SELECT l.* INTO v_lease FROM public.ocade_device_usage_leases AS l
   WHERE l.id = p_lease_id AND l.user_id = p_user_id AND l.device_id = p_device_id
   FOR UPDATE;
  IF NOT FOUND OR v_lease.status NOT IN ('active', 'preissued', 'pending_signature') THEN RETURN 0; END IF;
  v_unused := v_lease.allocated_hundredths - v_lease.consumed_hundredths;
  IF v_unused > 0 AND v_now < v_lease.session_reset_at THEN
    PERFORM public.ocade_release_commercial_work(
      p_user_id, 'session', v_lease.session_window_start, v_unused
    );
    IF v_lease.tier <> 'free' AND v_now < v_lease.week_reset_at THEN
      PERFORM public.ocade_release_commercial_work(
        p_user_id, 'week', v_lease.week_window_start, v_unused
      );
    END IF;
  END IF;
  UPDATE public.ocade_device_usage_leases AS l
     SET status = CASE WHEN v_now >= l.expires_at THEN 'expired' ELSE 'returned' END,
         updated_at = v_now
   WHERE l.id = p_lease_id;
  RETURN v_unused;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_read_offline_usage(p_user_id uuid)
RETURNS TABLE (
  lease_id uuid,
  device_id uuid,
  device_name text,
  status text,
  tier text,
  allocated_hundredths bigint,
  consumed_hundredths bigint,
  pending_hundredths bigint,
  session_window_start timestamptz,
  session_reset_at timestamptz,
  week_window_start timestamptz,
  week_reset_at timestamptz,
  preissued boolean,
  not_before timestamptz,
  expires_at timestamptz,
  last_sequence bigint,
  last_event_hash text,
  device_public_key text,
  key_id text,
  signed_payload jsonb,
  server_signature text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
BEGIN
  PERFORM public.ocade_expire_offline_usage_leases(p_user_id, statement_timestamp());
  RETURN QUERY
  SELECT l.id, l.device_id, d.name, l.status, l.tier,
    l.allocated_hundredths, l.consumed_hundredths,
    GREATEST(0::bigint, l.allocated_hundredths - l.consumed_hundredths),
    l.session_window_start, l.session_reset_at, l.week_window_start, l.week_reset_at,
    l.preissued,
    l.not_before, l.expires_at, l.last_sequence, l.last_event_hash,
    k.public_key_base64, l.key_id, l.signed_payload, l.server_signature
  FROM public.ocade_device_usage_leases AS l
  JOIN public.devices AS d ON d.id = l.device_id AND d.user_id = l.user_id
  JOIN public.ocade_device_usage_keys AS k
    ON k.device_id = l.device_id AND k.user_id = l.user_id
  WHERE l.user_id = p_user_id
  ORDER BY l.not_before, l.device_id;
END;
$$;

DO $$
DECLARE signature text;
BEGIN
  FOR signature IN SELECT unnest(ARRAY[
    'ocade_expire_offline_usage_leases(uuid,timestamptz)',
    'ocade_allocate_offline_usage(uuid,uuid,text,text,text,text,bigint,bigint,bigint,boolean)',
    'ocade_activate_offline_usage_lease(uuid,uuid,text,jsonb,text)',
    'ocade_reconcile_offline_usage(uuid,uuid,uuid,bigint,bigint,text,jsonb)',
    'ocade_return_offline_usage(uuid,uuid,uuid)',
    'ocade_read_offline_usage(uuid)'
  ]) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', signature);
  END LOOP;
END;
$$;

COMMENT ON TABLE public.ocade_device_usage_leases IS
  'Ed25519-signed, account/device/window-bound offline commercial allocations. Contains usage metadata only; no prompt or response content.';
COMMENT ON TABLE public.ocade_offline_usage_events IS
  'Append-only device-signed offline usage chain. Contains measurement metadata only; no prompt or response content.';

COMMIT;
