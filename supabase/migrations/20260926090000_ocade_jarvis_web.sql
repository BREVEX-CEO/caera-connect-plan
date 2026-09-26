-- OCADE JARVIS: the web surface's data authority.
--
-- ONE CONVERSATION AUTHORITY, TWO SURFACES. JARVIS conversations are rows in
-- `ocade_conversations` with `surface = 'jarvis'`, fixed at creation, so Chat
-- and JARVIS history cannot mix and a Chat conversation cannot be moved into
-- JARVIS (or back) by an update.
--
-- ONE LEDGER, TWO ALLOWANCES. The commercial permit lifecycle already reserves,
-- finalizes, releases and expires atomically. JARVIS permits use the same
-- functions with their own window kinds (`jarvis_session`, `jarvis_week`), so a
-- JARVIS step never spends Chat's allowance and Chat never spends JARVIS's.
-- The Chat window kinds and every Chat code path are unchanged.
--
-- EXECUTION STATE IS NOT A REVIVED TASKS PRODUCT. `jarvis_tasks` holds one
-- JARVIS task's plan, progress and durable result; `jarvis_activity` holds the
-- customer-safe activity and the queued browser actions a paired device runs;
-- `jarvis_devices` holds paired execution endpoints; `jarvis_permissions` holds
-- the master switch, capability and allowed-site decisions; `jarvis_memories`
-- is JARVIS's own memory namespace, separate from Chat.
--
-- Device credentials and pairing codes are stored only as SHA-256 hashes and
-- are never readable by a browser role.

BEGIN;

-- 1. Surface discriminator ----------------------------------------------------

ALTER TABLE public.ocade_conversations
  ADD COLUMN IF NOT EXISTS surface text NOT NULL DEFAULT 'chat';
ALTER TABLE public.ocade_conversations
  DROP CONSTRAINT IF EXISTS ocade_conversations_surface_check;
ALTER TABLE public.ocade_conversations
  ADD CONSTRAINT ocade_conversations_surface_check CHECK (surface IN ('chat', 'jarvis'));
CREATE INDEX IF NOT EXISTS ocade_conversations_user_surface_idx
  ON public.ocade_conversations (user_id, surface, updated_at DESC);

CREATE OR REPLACE FUNCTION public.ocade_conversation_surface_is_fixed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.surface IS DISTINCT FROM OLD.surface THEN
    RAISE EXCEPTION 'a conversation cannot change surface' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_conversation_surface_is_fixed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ocade_conversations_surface_fixed ON public.ocade_conversations;
CREATE TRIGGER ocade_conversations_surface_fixed
BEFORE UPDATE OF surface ON public.ocade_conversations
FOR EACH ROW EXECUTE FUNCTION public.ocade_conversation_surface_is_fixed();

-- 2. Separate JARVIS allowance in the one ledger --------------------------------

ALTER TABLE public.ocade_generation_permits
  DROP CONSTRAINT IF EXISTS ocade_generation_permits_surface_check;
ALTER TABLE public.ocade_generation_permits
  ADD CONSTRAINT ocade_generation_permits_surface_check CHECK (surface IN ('chat', 'jarvis'));

ALTER TABLE public.ocade_commercial_usage
  DROP CONSTRAINT IF EXISTS ocade_commercial_usage_window_kind_check;
ALTER TABLE public.ocade_commercial_usage
  ADD CONSTRAINT ocade_commercial_usage_window_kind_check
  CHECK (window_kind IN ('session', 'week', 'jarvis_session', 'jarvis_week'));

CREATE OR REPLACE FUNCTION public.ocade_usage_window_kind(p_surface text, p_kind text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT CASE WHEN p_surface = 'jarvis' THEN 'jarvis_' || p_kind ELSE p_kind END;
$$;
REVOKE ALL ON FUNCTION public.ocade_usage_window_kind(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_usage_window_kind(text, text) TO service_role;

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
    SELECT p.id, p.surface, p.reserved_hundredths, p.session_window_start,
           p.week_window_start, p.week_limit_hundredths
      FROM public.ocade_generation_permits AS p
     WHERE p.user_id = p_user_id
       AND p.status = 'reserved'
       AND p.expires_at <= p_now
     ORDER BY p.id
     FOR UPDATE
  LOOP
    PERFORM public.ocade_release_commercial_work(
      p_user_id, public.ocade_usage_window_kind(v_permit.surface, 'session'),
      v_permit.session_window_start, v_permit.reserved_hundredths
    );
    IF v_permit.week_limit_hundredths IS NOT NULL THEN
      PERFORM public.ocade_release_commercial_work(
        p_user_id, public.ocade_usage_window_kind(v_permit.surface, 'week'),
        v_permit.week_window_start, v_permit.reserved_hundredths
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
     OR p_surface IS NULL OR p_surface NOT IN ('chat', 'jarvis')
     OR p_tier NOT IN ('free', 'pro', 'max')
     OR p_session_limit_hundredths <= 0
     OR p_reserved_hundredths <= 0
     OR (p_week_limit_hundredths IS NOT NULL AND p_week_limit_hundredths <= 0)
  THEN
    RAISE EXCEPTION 'invalid commercial permit request' USING ERRCODE = 'check_violation';
  END IF;

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
  -- A settled permit is never re-armed under another surface's allowance.
  IF FOUND AND v_existing.surface <> p_surface THEN
    RETURN QUERY SELECT v_existing.id, 'idempotency_conflict'::text,
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
      p_user_id, public.ocade_usage_window_kind(p_surface, 'session'), v_session_start,
      p_reserved_hundredths, p_session_limit_hundredths
    );
  EXCEPTION WHEN check_violation THEN
    RETURN QUERY SELECT NULL::uuid, 'session_exhausted'::text,
      0::bigint, v_session_reset, v_week_reset;
    RETURN;
  END;

  IF p_week_limit_hundredths IS NOT NULL THEN
    BEGIN
      PERFORM public.ocade_consume_commercial_work(
        p_user_id, public.ocade_usage_window_kind(p_surface, 'week'), v_week_start,
        p_reserved_hundredths, p_week_limit_hundredths
      );
    EXCEPTION WHEN check_violation THEN
      PERFORM public.ocade_release_commercial_work(
        p_user_id, public.ocade_usage_window_kind(p_surface, 'session'), v_session_start,
        p_reserved_hundredths
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
    PERFORM public.ocade_consume_commercial_work(
      p_user_id, public.ocade_usage_window_kind(v_permit.surface, 'session'),
      v_permit.session_window_start, v_difference, NULL
    );
    IF v_permit.week_limit_hundredths IS NOT NULL THEN
      PERFORM public.ocade_consume_commercial_work(
        p_user_id, public.ocade_usage_window_kind(v_permit.surface, 'week'),
        v_permit.week_window_start, v_difference, NULL
      );
    END IF;
  ELSIF v_difference < 0 THEN
    PERFORM public.ocade_release_commercial_work(
      p_user_id, public.ocade_usage_window_kind(v_permit.surface, 'session'),
      v_permit.session_window_start, -v_difference
    );
    IF v_permit.week_limit_hundredths IS NOT NULL THEN
      PERFORM public.ocade_release_commercial_work(
        p_user_id, public.ocade_usage_window_kind(v_permit.surface, 'week'),
        v_permit.week_window_start, -v_difference
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
    p_user_id, public.ocade_usage_window_kind(v_permit.surface, 'session'),
    v_permit.session_window_start, v_permit.reserved_hundredths
  );
  IF v_permit.week_limit_hundredths IS NOT NULL THEN
    PERFORM public.ocade_release_commercial_work(
      p_user_id, public.ocade_usage_window_kind(v_permit.surface, 'week'),
      v_permit.week_window_start, v_permit.reserved_hundredths
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

-- The read gains a surface. Chat callers pass nothing and read exactly what
-- they read before, now excluding JARVIS holds from Chat's reserved count.
DROP FUNCTION IF EXISTS public.ocade_read_commercial_usage(uuid);
CREATE FUNCTION public.ocade_read_commercial_usage(p_user_id uuid, p_surface text DEFAULT 'chat')
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
  IF p_surface IS NULL OR p_surface NOT IN ('chat', 'jarvis') THEN
    RAISE EXCEPTION 'invalid usage surface' USING ERRCODE = 'check_violation';
  END IF;
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
      AND u.window_kind = public.ocade_usage_window_kind(p_surface, w.kind)
      AND u.window_start = w.starts_at
    CROSS JOIN LATERAL (
      SELECT COALESCE(SUM(p.reserved_hundredths), 0)::bigint AS held
      FROM public.ocade_generation_permits p
      WHERE p.user_id = p_user_id AND p.status = 'reserved' AND p.surface = p_surface
        AND CASE WHEN w.kind = 'session' THEN p.session_window_start = w.starts_at
          ELSE p.week_window_start = w.starts_at AND p.week_limit_hundredths IS NOT NULL END
    ) r;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_read_commercial_usage(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_read_commercial_usage(uuid, text) TO service_role;

-- 3. Paired execution devices ---------------------------------------------------

CREATE TABLE IF NOT EXISTS public.jarvis_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'New device',
  platform text,
  token_hash text UNIQUE,
  pairing_code_hash text UNIQUE,
  pairing_expires_at timestamptz,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jarvis_devices_name_check CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT jarvis_devices_platform_check CHECK (platform IS NULL OR length(platform) <= 60),
  CONSTRAINT jarvis_devices_hash_shape CHECK (
    (token_hash IS NULL OR token_hash ~ '^[0-9a-f]{64}$')
    AND (pairing_code_hash IS NULL OR pairing_code_hash ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT jarvis_devices_capabilities_object CHECK (jsonb_typeof(capabilities) = 'object')
);
CREATE INDEX IF NOT EXISTS jarvis_devices_user_idx ON public.jarvis_devices (user_id, created_at DESC);

ALTER TABLE public.jarvis_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.jarvis_devices FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, user_id, name, platform, capabilities, last_seen_at, revoked_at, created_at)
  ON public.jarvis_devices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.jarvis_devices TO service_role;
DROP POLICY IF EXISTS jarvis_devices_own ON public.jarvis_devices;
CREATE POLICY jarvis_devices_own ON public.jarvis_devices FOR SELECT
  TO authenticated USING ((SELECT auth.uid()) = user_id);

-- 4. Master switch, capabilities and allowed sites --------------------------------

CREATE TABLE IF NOT EXISTS public.jarvis_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.jarvis_devices(id) ON DELETE CASCADE,
  capability text NOT NULL,
  allowed boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jarvis_permissions_capability_check CHECK (
    capability IN ('master', 'memory', 'autonomous', 'browser', 'browser_real', 'files',
      'screen', 'microphone', 'camera', 'apps', 'messaging', 'devices', 'computer_control')
    OR capability ~ '^site:[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$'
  ),
  CONSTRAINT jarvis_permissions_one_decision UNIQUE NULLS NOT DISTINCT (user_id, device_id, capability)
);
CREATE INDEX IF NOT EXISTS jarvis_permissions_device_idx ON public.jarvis_permissions (device_id);

ALTER TABLE public.jarvis_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.jarvis_permissions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.jarvis_permissions TO authenticated, service_role;
DROP POLICY IF EXISTS jarvis_permissions_own ON public.jarvis_permissions;
CREATE POLICY jarvis_permissions_own ON public.jarvis_permissions FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (device_id IS NULL OR EXISTS (
      SELECT 1 FROM public.jarvis_devices AS d
       WHERE d.id = device_id AND d.user_id = (SELECT auth.uid())
    ))
  );

-- 5. Tasks: plan, progress, durable result ------------------------------------------

CREATE TABLE IF NOT EXISTS public.jarvis_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.ocade_conversations(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.jarvis_devices(id) ON DELETE SET NULL,
  title text NOT NULL,
  plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_step integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  blocker text,
  result text,
  browser_mode text NOT NULL DEFAULT 'isolated',
  live_frame text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT jarvis_tasks_title_check CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  CONSTRAINT jarvis_tasks_plan_check CHECK (jsonb_typeof(plan) = 'array' AND jsonb_array_length(plan) <= 12),
  CONSTRAINT jarvis_tasks_step_check CHECK (current_step >= 0 AND current_step <= 12),
  CONSTRAINT jarvis_tasks_status_check CHECK (
    status IN ('running', 'waiting', 'taken_over', 'stopped', 'blocked', 'failed', 'completed')
  ),
  CONSTRAINT jarvis_tasks_blocker_check CHECK (blocker IS NULL OR length(blocker) <= 300),
  CONSTRAINT jarvis_tasks_result_check CHECK (result IS NULL OR length(result) <= 8000),
  CONSTRAINT jarvis_tasks_mode_check CHECK (browser_mode IN ('isolated', 'real')),
  CONSTRAINT jarvis_tasks_frame_check CHECK (live_frame IS NULL OR length(live_frame) <= 400000)
);
CREATE INDEX IF NOT EXISTS jarvis_tasks_user_idx ON public.jarvis_tasks (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS jarvis_tasks_conversation_idx ON public.jarvis_tasks (conversation_id);
CREATE INDEX IF NOT EXISTS jarvis_tasks_device_idx ON public.jarvis_tasks (device_id);

-- A raw frame is temporary: it is gone the moment the task stops running.
CREATE OR REPLACE FUNCTION public.jarvis_task_frame_is_temporary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status IN ('stopped', 'blocked', 'failed', 'completed') THEN
    NEW.live_frame := NULL;
    NEW.finished_at := COALESCE(NEW.finished_at, now());
  ELSE
    NEW.finished_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_task_frame_is_temporary() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS jarvis_tasks_frame_is_temporary ON public.jarvis_tasks;
CREATE TRIGGER jarvis_tasks_frame_is_temporary
BEFORE INSERT OR UPDATE ON public.jarvis_tasks
FOR EACH ROW EXECUTE FUNCTION public.jarvis_task_frame_is_temporary();

ALTER TABLE public.jarvis_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.jarvis_tasks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.jarvis_tasks TO authenticated, service_role;
DROP POLICY IF EXISTS jarvis_tasks_own ON public.jarvis_tasks;
CREATE POLICY jarvis_tasks_own ON public.jarvis_tasks FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.ocade_conversations AS c
       WHERE c.id = conversation_id AND c.user_id = (SELECT auth.uid()) AND c.surface = 'jarvis'
    )
    AND (device_id IS NULL OR EXISTS (
      SELECT 1 FROM public.jarvis_devices AS d
       WHERE d.id = device_id AND d.user_id = (SELECT auth.uid()) AND d.revoked_at IS NULL
    ))
  );

-- 6. Activity and the device action queue (90-day detail) -----------------------------

CREATE TABLE IF NOT EXISTS public.jarvis_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.jarvis_tasks(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.jarvis_devices(id) ON DELETE SET NULL,
  summary text NOT NULL,
  action jsonb,
  confirmed boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'note',
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT jarvis_activity_summary_check CHECK (length(btrim(summary)) BETWEEN 1 AND 300),
  CONSTRAINT jarvis_activity_status_check CHECK (status IN (
    'note', 'queued', 'claimed', 'done', 'failed', 'cancelled',
    'needs_confirmation', 'blocked', 'human_required'
  )),
  CONSTRAINT jarvis_activity_action_shape CHECK (
    (status = 'note') = (action IS NULL)
    AND (action IS NULL OR jsonb_typeof(action) = 'object')
  ),
  CONSTRAINT jarvis_activity_result_size CHECK (result IS NULL OR pg_column_size(result) <= 65536)
);
CREATE INDEX IF NOT EXISTS jarvis_activity_task_idx ON public.jarvis_activity (task_id, created_at);
CREATE INDEX IF NOT EXISTS jarvis_activity_queue_idx ON public.jarvis_activity (device_id, status, created_at);
CREATE INDEX IF NOT EXISTS jarvis_activity_retention_idx ON public.jarvis_activity (user_id, created_at);

ALTER TABLE public.jarvis_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.jarvis_activity FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.jarvis_activity TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.jarvis_activity TO service_role;
DROP POLICY IF EXISTS jarvis_activity_own ON public.jarvis_activity;
CREATE POLICY jarvis_activity_own ON public.jarvis_activity FOR SELECT
  TO authenticated USING ((SELECT auth.uid()) = user_id);

-- 7. JARVIS memory namespace -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.jarvis_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jarvis_memories_content_check CHECK (length(btrim(content)) BETWEEN 1 AND 500)
);
CREATE INDEX IF NOT EXISTS jarvis_memories_user_idx ON public.jarvis_memories (user_id, created_at DESC);

ALTER TABLE public.jarvis_memories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.jarvis_memories FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.jarvis_memories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.jarvis_memories TO service_role;
DROP POLICY IF EXISTS jarvis_memories_own ON public.jarvis_memories;
CREATE POLICY jarvis_memories_own ON public.jarvis_memories FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- 8. Retention: detailed activity lives 90 days; task results stay; a frame
--    left by a task nobody is running is gone within the hour -------------------

CREATE OR REPLACE FUNCTION public.jarvis_purge_expired_activity(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_removed integer;
BEGIN
  DELETE FROM public.jarvis_activity AS a
   WHERE a.user_id = p_user_id AND a.created_at < now() - INTERVAL '90 days';
  GET DIAGNOSTICS v_removed = ROW_COUNT;
  UPDATE public.jarvis_tasks AS t
     SET live_frame = NULL
   WHERE t.user_id = p_user_id AND t.live_frame IS NOT NULL
     AND t.updated_at < now() - INTERVAL '1 hour';
  RETURN v_removed;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_purge_expired_activity(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_purge_expired_activity(uuid) TO service_role;

COMMIT;
