-- Durable, account-scoped commercial generation permits.
--
-- `ocade_commercial_usage` is already the single counter authority, but the
-- permit that explained a reservation used to live only in a server process.
-- A restart therefore could not finalize or release it, and another instance
-- could reserve the same logical request again.  This migration makes the
-- lifecycle transactional in Postgres while retaining that existing counter.

BEGIN;

-- These mutations are invoked only by service_role.  They do not need owner
-- elevation, so make that property explicit and remove them from the
-- authenticated SECURITY DEFINER advisor class.
ALTER FUNCTION public.ocade_consume_commercial_work(UUID, text, TIMESTAMPTZ, bigint, bigint)
  SECURITY INVOKER;
ALTER FUNCTION public.ocade_consume_commercial_work(UUID, text, TIMESTAMPTZ, bigint, bigint)
  SET search_path TO '';
ALTER FUNCTION public.ocade_release_commercial_work(UUID, text, TIMESTAMPTZ, bigint)
  SECURITY INVOKER;
ALTER FUNCTION public.ocade_release_commercial_work(UUID, text, TIMESTAMPTZ, bigint)
  SET search_path TO '';

CREATE TABLE public.ocade_generation_permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  generation_id text NOT NULL,
  surface text NOT NULL,
  tier text NOT NULL,
  status text NOT NULL DEFAULT 'reserved',
  reserved_hundredths bigint NOT NULL,
  charged_hundredths bigint,
  session_limit_hundredths bigint NOT NULL,
  week_limit_hundredths bigint,
  session_window_start timestamptz NOT NULL,
  session_reset_at timestamptz NOT NULL,
  week_window_start timestamptz NOT NULL,
  week_reset_at timestamptz NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  expires_at timestamptz NOT NULL,
  finalized_at timestamptz,
  release_reason text,
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT ocade_generation_permits_idempotency_key_check
    CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 200),
  CONSTRAINT ocade_generation_permits_generation_id_check
    CHECK (length(btrim(generation_id)) BETWEEN 1 AND 200),
  CONSTRAINT ocade_generation_permits_surface_check
    CHECK (surface IN (
      'chat', 'cowork', 'code', 'task', 'automation',
      'background_agent', 'voice', 'artifact'
    )),
  CONSTRAINT ocade_generation_permits_tier_check
    CHECK (tier IN ('free', 'pro', 'max')),
  CONSTRAINT ocade_generation_permits_status_check
    CHECK (status IN ('reserved', 'succeeded', 'released', 'expired')),
  CONSTRAINT ocade_generation_permits_reserved_check
    CHECK (reserved_hundredths > 0),
  CONSTRAINT ocade_generation_permits_charged_check
    CHECK (charged_hundredths IS NULL OR charged_hundredths >= 0),
  CONSTRAINT ocade_generation_permits_session_limit_check
    CHECK (session_limit_hundredths > 0),
  CONSTRAINT ocade_generation_permits_week_limit_check
    CHECK (week_limit_hundredths IS NULL OR week_limit_hundredths > 0),
  CONSTRAINT ocade_generation_permits_window_order_check
    CHECK (
      session_reset_at > session_window_start
      AND week_reset_at > week_window_start
      AND expires_at > issued_at
    ),
  CONSTRAINT ocade_generation_permits_user_idempotency_key
    UNIQUE (user_id, idempotency_key)
);

CREATE INDEX ocade_generation_permits_active_expiry_idx
  ON public.ocade_generation_permits (user_id, expires_at)
  WHERE status = 'reserved';
CREATE INDEX ocade_generation_permits_generation_idx
  ON public.ocade_generation_permits (user_id, generation_id);

ALTER TABLE public.ocade_generation_permits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ocade_generation_permits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ocade_generation_permits TO service_role;

COMMENT ON TABLE public.ocade_generation_permits IS
  'Backend-neutral generation permits. One durable row per account/idempotency key; contains usage metadata only and never prompt or response content.';

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
    FROM auth.users AS u
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
  IF p_cost_hundredths < 0 OR p_cost_hundredths > 1000000000 THEN
    RAISE EXCEPTION 'invalid commercial usage cost' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM u.id FROM auth.users AS u WHERE u.id = p_user_id FOR UPDATE;
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
  PERFORM u.id FROM auth.users AS u WHERE u.id = p_user_id FOR UPDATE;
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

CREATE OR REPLACE FUNCTION public.ocade_read_commercial_usage(
  p_user_id uuid
)
RETURNS TABLE (
  window_kind text,
  window_start timestamptz,
  reset_at timestamptz,
  used_hundredths bigint,
  reserved_hundredths bigint
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
  v_week_start timestamptz;
  v_session_total bigint;
  v_session_reserved bigint;
  v_week_total bigint;
  v_week_reserved bigint;
BEGIN
  SELECT u.created_at INTO v_anchor
    FROM auth.users AS u
   WHERE u.id = p_user_id;
  IF v_anchor IS NULL THEN
    RAISE EXCEPTION 'unknown commercial usage account' USING ERRCODE = 'foreign_key_violation';
  END IF;

  PERFORM public.ocade_expire_commercial_permits(p_user_id, v_now);

  v_elapsed_seconds := GREATEST(0, EXTRACT(epoch FROM (v_now - v_anchor)));
  v_session_start := v_anchor
    + FLOOR(v_elapsed_seconds / 23280) * INTERVAL '23280 seconds';
  v_week_start := v_anchor
    + FLOOR(v_elapsed_seconds / 604800) * INTERVAL '604800 seconds';

  SELECT COALESCE(u.used_hundredths, 0::bigint)
    INTO v_session_total
    FROM (SELECT 1) AS one
    LEFT JOIN public.ocade_commercial_usage AS u
      ON u.user_id = p_user_id
     AND u.window_kind = 'session'
     AND u.window_start = v_session_start;
  SELECT COALESCE(SUM(p.reserved_hundredths), 0::numeric)::bigint
    INTO v_session_reserved
    FROM public.ocade_generation_permits AS p
   WHERE p.user_id = p_user_id
     AND p.status = 'reserved'
     AND p.session_window_start = v_session_start;

  SELECT COALESCE(u.used_hundredths, 0::bigint)
    INTO v_week_total
    FROM (SELECT 1) AS one
    LEFT JOIN public.ocade_commercial_usage AS u
      ON u.user_id = p_user_id
     AND u.window_kind = 'week'
     AND u.window_start = v_week_start;
  SELECT COALESCE(SUM(p.reserved_hundredths), 0::numeric)::bigint
    INTO v_week_reserved
    FROM public.ocade_generation_permits AS p
   WHERE p.user_id = p_user_id
     AND p.status = 'reserved'
     AND p.week_window_start = v_week_start
     AND p.week_limit_hundredths IS NOT NULL;

  RETURN QUERY
  SELECT
    'session'::text,
    v_session_start,
    v_session_start + INTERVAL '388 minutes',
    GREATEST(0::bigint, v_session_total - v_session_reserved),
    v_session_reserved;

  RETURN QUERY
  SELECT
    'week'::text,
    v_week_start,
    v_week_start + INTERVAL '7 days',
    GREATEST(0::bigint, v_week_total - v_week_reserved),
    v_week_reserved;
END;
$$;

REVOKE ALL ON FUNCTION public.ocade_expire_commercial_permits(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_acquire_generation_permit(
  uuid, text, text, text, text, bigint, bigint, bigint
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_finalize_generation_permit(uuid, text, bigint)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_release_generation_permit(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_read_commercial_usage(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ocade_expire_commercial_permits(uuid, timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.ocade_acquire_generation_permit(
  uuid, text, text, text, text, bigint, bigint, bigint
) TO service_role;
GRANT EXECUTE ON FUNCTION public.ocade_finalize_generation_permit(uuid, text, bigint)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.ocade_release_generation_permit(uuid, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.ocade_read_commercial_usage(uuid)
  TO service_role;

COMMIT;
