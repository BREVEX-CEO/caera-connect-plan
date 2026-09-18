-- Preserve usage-window identities while moving runtime authority off auth.users.
-- Only this owner-run migration reads auth.users; service_role gains no access.
BEGIN;

-- Block concurrent accounting and signups while the anchor is copied once.
LOCK TABLE auth.users IN SHARE MODE;
LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO public.profiles (id, email, phone, created_at)
SELECT id, email, phone, created_at FROM auth.users
ON CONFLICT (id) DO UPDATE SET created_at = EXCLUDED.created_at
WHERE public.profiles.created_at IS DISTINCT FROM EXCLUDED.created_at;

-- The account anchor and identity must not be editable through a user JWT.
REVOKE UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (display_name, avatar_url, locale, timezone, currency, country,
  onboarding_completed, onboarding_step, updated_at, full_name, preferred_name,
  occupation, custom_instructions, email, phone) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, email, phone, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email,
    NEW.phone,
    NEW.created_at
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone);

  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- All lifecycle operations lock the same account before permits or counters.
-- CREATE OR REPLACE retains the existing service_role-only EXECUTE grants.
CREATE OR REPLACE FUNCTION public.ocade_expire_commercial_permits(
  p_user_id uuid,
  p_now timestamptz DEFAULT statement_timestamp()
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_permit record;
  v_expired integer := 0;
BEGIN
  PERFORM u.id FROM public.profiles AS u WHERE u.id = p_user_id FOR UPDATE;
  FOR v_permit IN
    SELECT p.id, p.reserved_hundredths, p.session_window_start,
           p.week_window_start, p.week_limit_hundredths
      FROM public.ocade_generation_permits AS p
     WHERE p.user_id = p_user_id
       AND p.status = 'reserved'
       AND p.expires_at <= p_now
     ORDER BY p.id
     FOR UPDATE
  LOOP
    PERFORM public.ocade_release_commercial_work(
      p_user_id, 'session', v_permit.session_window_start,
      v_permit.reserved_hundredths
    );
    IF v_permit.week_limit_hundredths IS NOT NULL THEN
      PERFORM public.ocade_release_commercial_work(
        p_user_id, 'week', v_permit.week_window_start,
        v_permit.reserved_hundredths
      );
    END IF;

    UPDATE public.ocade_generation_permits AS p
       SET status = 'expired', finalized_at = p_now,
           release_reason = 'reservation_expired', updated_at = p_now
     WHERE p.id = v_permit.id;
    v_expired := v_expired + 1;
  END LOOP;
  RETURN v_expired;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_acquire_generation_permit(
  p_user_id uuid,
  p_idempotency_key text,
  p_generation_id text,
  p_surface text,
  p_tier text,
  p_session_limit_hundredths bigint,
  p_week_limit_hundredths bigint,
  p_reserved_hundredths bigint
)
RETURNS TABLE (
  permit_id uuid,
  outcome text,
  reserved_hundredths bigint,
  session_reset_at timestamptz,
  week_reset_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_now timestamptz := statement_timestamp();
  v_anchor timestamptz;
  v_elapsed_seconds numeric;
  v_session_start timestamptz;
  v_session_reset timestamptz;
  v_week_start timestamptz;
  v_week_reset timestamptz;
  v_existing record;
  v_permit_id uuid;
BEGIN
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) NOT BETWEEN 1 AND 200
     OR p_generation_id IS NULL OR length(btrim(p_generation_id)) NOT BETWEEN 1 AND 200
     OR p_surface NOT IN (
       'chat', 'cowork', 'code', 'task', 'automation',
       'background_agent', 'voice', 'artifact'
     )
     OR p_tier NOT IN ('free', 'pro', 'max')
     OR p_session_limit_hundredths <= 0
     OR p_reserved_hundredths <= 0
     OR (p_week_limit_hundredths IS NOT NULL AND p_week_limit_hundredths <= 0)
  THEN
    RAISE EXCEPTION 'invalid commercial permit request' USING ERRCODE = 'check_violation';
  END IF;

  -- Serializing on the immutable account row makes the two usage-window
  -- reservations and the account/idempotency lookup one atomic decision even
  -- when many server instances acquire concurrently.
  SELECT u.created_at INTO v_anchor
    FROM public.profiles AS u
   WHERE u.id = p_user_id
   FOR UPDATE;
  IF v_anchor IS NULL THEN
    RAISE EXCEPTION 'unknown commercial usage account' USING ERRCODE = 'foreign_key_violation';
  END IF;

  PERFORM public.ocade_expire_commercial_permits(p_user_id, v_now);

  SELECT p.* INTO v_existing
    FROM public.ocade_generation_permits AS p
   WHERE p.user_id = p_user_id AND p.idempotency_key = btrim(p_idempotency_key)
   FOR UPDATE;

  IF FOUND AND v_existing.status = 'succeeded' THEN
    RETURN QUERY SELECT v_existing.id, 'duplicate_completed'::text,
      v_existing.reserved_hundredths, v_existing.session_reset_at,
      v_existing.week_reset_at;
    RETURN;
  END IF;
  IF FOUND AND v_existing.status = 'reserved' THEN
    IF v_existing.generation_id <> btrim(p_generation_id)
       OR v_existing.surface <> p_surface THEN
      RETURN QUERY SELECT v_existing.id, 'idempotency_conflict'::text,
        v_existing.reserved_hundredths, v_existing.session_reset_at,
        v_existing.week_reset_at;
      RETURN;
    END IF;
    RETURN QUERY SELECT v_existing.id, 'granted'::text,
      v_existing.reserved_hundredths, v_existing.session_reset_at,
      v_existing.week_reset_at;
    RETURN;
  END IF;

  v_elapsed_seconds := GREATEST(0, EXTRACT(epoch FROM (v_now - v_anchor)));
  v_session_start := v_anchor
    + FLOOR(v_elapsed_seconds / 23280) * INTERVAL '23280 seconds';
  v_session_reset := v_session_start + INTERVAL '388 minutes';
  v_week_start := v_anchor
    + FLOOR(v_elapsed_seconds / 604800) * INTERVAL '604800 seconds';
  v_week_reset := v_week_start + INTERVAL '7 days';

  BEGIN
    PERFORM public.ocade_consume_commercial_work(
      p_user_id, 'session', v_session_start, p_reserved_hundredths,
      p_session_limit_hundredths
    );
  EXCEPTION WHEN check_violation THEN
    RETURN QUERY SELECT NULL::uuid, 'session_exhausted'::text,
      0::bigint, v_session_reset, v_week_reset;
    RETURN;
  END;

  IF p_week_limit_hundredths IS NOT NULL THEN
    BEGIN
      PERFORM public.ocade_consume_commercial_work(
        p_user_id, 'week', v_week_start, p_reserved_hundredths,
        p_week_limit_hundredths
      );
    EXCEPTION WHEN check_violation THEN
      PERFORM public.ocade_release_commercial_work(
        p_user_id, 'session', v_session_start, p_reserved_hundredths
      );
      RETURN QUERY SELECT NULL::uuid, 'week_exhausted'::text,
        0::bigint, v_session_reset, v_week_reset;
      RETURN;
    END;
  END IF;

  IF v_existing.id IS NULL THEN
    INSERT INTO public.ocade_generation_permits (
      user_id, idempotency_key, generation_id, surface, tier, status,
      reserved_hundredths, charged_hundredths,
      session_limit_hundredths, week_limit_hundredths,
      session_window_start, session_reset_at, week_window_start, week_reset_at,
      issued_at, expires_at, finalized_at, release_reason, updated_at
    ) VALUES (
      p_user_id, btrim(p_idempotency_key), btrim(p_generation_id), p_surface,
      p_tier, 'reserved', p_reserved_hundredths, NULL,
      p_session_limit_hundredths, p_week_limit_hundredths,
      v_session_start, v_session_reset, v_week_start, v_week_reset,
      v_now, LEAST(v_session_reset, v_now + INTERVAL '30 minutes'),
      NULL, NULL, v_now
    ) RETURNING id INTO v_permit_id;
  ELSE
    v_permit_id := v_existing.id;
    UPDATE public.ocade_generation_permits AS p
       SET generation_id = btrim(p_generation_id), surface = p_surface,
           tier = p_tier, status = 'reserved',
           reserved_hundredths = p_reserved_hundredths,
           charged_hundredths = NULL,
           session_limit_hundredths = p_session_limit_hundredths,
           week_limit_hundredths = p_week_limit_hundredths,
           session_window_start = v_session_start,
           session_reset_at = v_session_reset,
           week_window_start = v_week_start,
           week_reset_at = v_week_reset,
           issued_at = v_now,
           expires_at = LEAST(v_session_reset, v_now + INTERVAL '30 minutes'),
           finalized_at = NULL, release_reason = NULL, updated_at = v_now
     WHERE p.id = v_permit_id;
  END IF;

  RETURN QUERY SELECT v_permit_id, 'granted'::text,
    p_reserved_hundredths, v_session_reset, v_week_reset;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_finalize_generation_permit(
  p_user_id uuid,
  p_idempotency_key text,
  p_cost_hundredths bigint
)
RETURNS TABLE (charged_hundredths bigint, outcome text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_permit record;
  v_total bigint;
  v_difference bigint;
  v_now timestamptz := statement_timestamp();
BEGIN
  IF p_cost_hundredths IS NULL OR p_cost_hundredths < 0 OR p_cost_hundredths > 1000000000 THEN
    RAISE EXCEPTION 'invalid commercial usage cost' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM u.id FROM public.profiles AS u WHERE u.id = p_user_id FOR UPDATE;
  PERFORM public.ocade_expire_commercial_permits(p_user_id, v_now);
  SELECT p.* INTO v_permit
    FROM public.ocade_generation_permits AS p
   WHERE p.user_id = p_user_id AND p.idempotency_key = btrim(p_idempotency_key)
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::bigint, 'missing'::text;
    RETURN;
  END IF;
  IF v_permit.status = 'succeeded' THEN
    RETURN QUERY SELECT v_permit.charged_hundredths, 'succeeded'::text;
    RETURN;
  END IF;
  IF v_permit.status <> 'reserved' THEN
    RETURN QUERY SELECT 0::bigint, v_permit.status::text;
    RETURN;
  END IF;

  v_total := CASE WHEN v_permit.tier = 'free' THEN 100
                  ELSE GREATEST(25, p_cost_hundredths) END;
  v_difference := v_total - v_permit.reserved_hundredths;

  IF v_difference > 0 THEN
    -- Once work was admitted, settle the observed result.  The next request is
    -- where an overrun is refused; interrupting a delivered result is worse.
    PERFORM public.ocade_consume_commercial_work(
      p_user_id, 'session', v_permit.session_window_start,
      v_difference, NULL
    );
    IF v_permit.week_limit_hundredths IS NOT NULL THEN
      PERFORM public.ocade_consume_commercial_work(
        p_user_id, 'week', v_permit.week_window_start,
        v_difference, NULL
      );
    END IF;
  ELSIF v_difference < 0 THEN
    PERFORM public.ocade_release_commercial_work(
      p_user_id, 'session', v_permit.session_window_start, -v_difference
    );
    IF v_permit.week_limit_hundredths IS NOT NULL THEN
      PERFORM public.ocade_release_commercial_work(
        p_user_id, 'week', v_permit.week_window_start, -v_difference
      );
    END IF;
  END IF;

  UPDATE public.ocade_generation_permits AS p
     SET status = 'succeeded', charged_hundredths = v_total,
         finalized_at = v_now, updated_at = v_now
   WHERE p.id = v_permit.id;

  RETURN QUERY SELECT v_total, 'succeeded'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_release_generation_permit(
  p_user_id uuid,
  p_idempotency_key text,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_permit record;
  v_now timestamptz := statement_timestamp();
BEGIN
  PERFORM u.id FROM public.profiles AS u WHERE u.id = p_user_id FOR UPDATE;
  SELECT p.* INTO v_permit
    FROM public.ocade_generation_permits AS p
   WHERE p.user_id = p_user_id AND p.idempotency_key = btrim(p_idempotency_key)
   FOR UPDATE;
  IF NOT FOUND OR v_permit.status <> 'reserved' THEN
    RETURN false;
  END IF;

  PERFORM public.ocade_release_commercial_work(
    p_user_id, 'session', v_permit.session_window_start,
    v_permit.reserved_hundredths
  );
  IF v_permit.week_limit_hundredths IS NOT NULL THEN
    PERFORM public.ocade_release_commercial_work(
      p_user_id, 'week', v_permit.week_window_start,
      v_permit.reserved_hundredths
    );
  END IF;

  UPDATE public.ocade_generation_permits AS p
     SET status = 'released', charged_hundredths = 0,
         finalized_at = v_now,
         release_reason = left(COALESCE(NULLIF(btrim(p_reason), ''), 'released'), 80),
         updated_at = v_now
   WHERE p.id = v_permit.id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_read_commercial_usage(p_user_id uuid)
RETURNS TABLE (
  window_kind text, window_start timestamptz, reset_at timestamptz,
  used_hundredths bigint, reserved_hundredths bigint
)
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $$
DECLARE
  v_now timestamptz := statement_timestamp();
  v_anchor timestamptz;
  v_elapsed numeric;
BEGIN
  SELECT p.created_at INTO v_anchor FROM public.profiles p
    WHERE p.id = p_user_id FOR UPDATE;
  IF v_anchor IS NULL THEN
    RAISE EXCEPTION 'unknown commercial usage account' USING ERRCODE = 'foreign_key_violation';
  END IF;
  PERFORM public.ocade_expire_commercial_permits(p_user_id, v_now);
  v_elapsed := GREATEST(0, EXTRACT(epoch FROM (v_now - v_anchor)));
  RETURN QUERY
    SELECT w.kind, w.starts_at, w.starts_at + w.duration,
      GREATEST(0::bigint, COALESCE(u.used_hundredths, 0) - r.held), r.held
    FROM (VALUES
      ('session'::text, v_anchor + FLOOR(v_elapsed / 23280) * INTERVAL '23280 seconds', INTERVAL '388 minutes'),
      ('week'::text, v_anchor + FLOOR(v_elapsed / 604800) * INTERVAL '604800 seconds', INTERVAL '7 days')
    ) AS w(kind, starts_at, duration)
    LEFT JOIN public.ocade_commercial_usage u ON u.user_id = p_user_id
      AND u.window_kind = w.kind AND u.window_start = w.starts_at
    CROSS JOIN LATERAL (
      SELECT COALESCE(SUM(p.reserved_hundredths), 0)::bigint AS held
      FROM public.ocade_generation_permits p
      WHERE p.user_id = p_user_id AND p.status = 'reserved'
        AND CASE WHEN w.kind = 'session' THEN p.session_window_start = w.starts_at
          ELSE p.week_window_start = w.starts_at AND p.week_limit_hundredths IS NOT NULL END
    ) r;
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
    FROM public.profiles AS u WHERE u.id = p_user_id FOR UPDATE;
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

  PERFORM public.ocade_expire_commercial_permits(p_user_id, v_now);
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
  PERFORM u.id FROM public.profiles AS u WHERE u.id = p_user_id FOR UPDATE;
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

COMMIT;
