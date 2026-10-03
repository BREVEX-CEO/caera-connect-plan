-- THE OWNER AND STAFF CONSOLES MOVE INTO OCADE.IN, AND OWNERS USE OCADE WITHOUT LIMIT.
--
-- PLAN.md Phases 53-54 (owner authority 2026-10-03). Three changes:
--
-- 1. Staff authority belongs to the account's own ocade.in session. The console
--    was to live on admin.ocade.in with a session of its own (20261001090000 and
--    20261001095100, never applied to production); the owner moved it into the
--    site. What still holds a staff session to account, every request: the role
--    and permission in public.ocade_staff, a session that has not been ended, the
--    second factor answered in this session (all staff but a Primary Owner still
--    setting it up, who may look and never change), NO factor added during this
--    session (a stolen token cannot enroll its own authenticator and answer it),
--    and a recent proof for every change (private.ocade_staff_require).
--
-- 2. Unlimited use. Owners (Primary and every other Owner) are never stopped by
--    a usage window; an owner may also give an account unlimited use until a
--    date or until revoked. Usage is still recorded exactly as before, so the
--    usage screens, cost telemetry and the audit stay true. The decision is
--    made at the one place every allowance is enforced
--    (public.ocade_consume_commercial_work): Chat, JARVIS and offline leases.
--
-- 3. Handing over ownership says what the former Primary Owner becomes: still an
--    Owner (the default), or no longer staff. There is always exactly one
--    Primary Owner; the swap is one transaction.
BEGIN;

-- 1. Staff authority on the site's session -----------------------------------------

CREATE OR REPLACE FUNCTION private.ocade_staff_has(p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ocade_staff AS s
     WHERE s.user_id = auth.uid()
       AND (p_permission = ANY (private.ocade_role_permissions(s.role))
            OR p_permission = ANY (s.granted))
       AND NOT (p_permission = ANY (s.denied))
  ) AND private.ocade_caller_session_live() AND NOT public.ocade_factor_added_since_sign_in();
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN false
    WHEN _role = 'admin'::public.app_role THEN EXISTS (
      SELECT 1 FROM public.ocade_staff
       WHERE user_id = _user_id AND role IN ('primary_owner', 'backup_owner', 'admin')
         AND (auth.uid() IS NULL OR role = 'primary_owner'
              OR COALESCE(auth.jwt() ->> 'aal', '') = 'aal2')
    ) AND (auth.uid() IS NULL OR NOT public.ocade_factor_added_since_sign_in())
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
    )
  END;
$$;

CREATE OR REPLACE FUNCTION private.ocade_is_support_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ocade_staff
     WHERE user_id = (SELECT auth.uid()) AND role IN ('primary_owner', 'backup_owner', 'admin')
       AND (role = 'primary_owner' OR COALESCE(auth.jwt() ->> 'aal', '') = 'aal2')
  ) AND NOT public.ocade_factor_added_since_sign_in();
$$;

-- The console's own sessions are gone with its origin.
DROP FUNCTION IF EXISTS private.ocade_caller_in_console();
DROP TABLE IF EXISTS public.ocade_console_sessions;

-- 2. Unlimited use ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ocade_unlimited_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 10 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- NULL: until an owner revokes it.
  ends_at timestamptz CHECK (ends_at IS NULL OR ends_at > created_at),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoke_reason text CHECK (revoke_reason IS NULL OR length(btrim(revoke_reason)) BETWEEN 10 AND 500)
);
CREATE UNIQUE INDEX IF NOT EXISTS ocade_unlimited_grants_one_open
  ON public.ocade_unlimited_grants (user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS ocade_unlimited_grants_granted_by ON public.ocade_unlimited_grants (granted_by);
CREATE INDEX IF NOT EXISTS ocade_unlimited_grants_revoked_by ON public.ocade_unlimited_grants (revoked_by);
ALTER TABLE public.ocade_unlimited_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ocade_unlimited_grants FROM PUBLIC, anon, authenticated;
-- Read by the server; written only by the functions below.
REVOKE ALL ON TABLE public.ocade_unlimited_grants FROM service_role;
GRANT SELECT ON TABLE public.ocade_unlimited_grants TO service_role;

-- Is this account never stopped by a usage window right now, and why?
CREATE OR REPLACE FUNCTION private.ocade_usage_unlimited(p_user uuid)
RETURNS TABLE (why text, ends_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT u.why, u.ends_at FROM (
    SELECT 'owner'::text AS why, NULL::timestamptz AS ends_at
      FROM public.ocade_staff AS s
     WHERE s.user_id = p_user AND s.role IN ('primary_owner', 'backup_owner')
    UNION ALL
    SELECT 'grant'::text, g.ends_at
      FROM public.ocade_unlimited_grants AS g
     WHERE g.user_id = p_user AND g.revoked_at IS NULL AND (g.ends_at IS NULL OR g.ends_at > now())
  ) AS u
  ORDER BY u.why = 'owner' DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION private.ocade_usage_unlimited(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.ocade_usage_unlimited(uuid) TO service_role;

-- The server's question about an account (never a browser's).
CREATE OR REPLACE FUNCTION public.ocade_account_unlimited(target_user uuid)
RETURNS TABLE (why text, ends_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$ SELECT u.why, u.ends_at FROM private.ocade_usage_unlimited(target_user) AS u $$;
REVOKE ALL ON FUNCTION public.ocade_account_unlimited(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_account_unlimited(uuid) TO service_role;

-- Every allowance is enforced here. Unlimited still records; it is only never refused.
CREATE OR REPLACE FUNCTION public.ocade_consume_commercial_work(
  p_user_id uuid,
  p_window_kind text,
  p_window_start timestamptz,
  p_cost_hundredths bigint,
  p_limit_hundredths bigint
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_used bigint;
BEGIN
  IF p_cost_hundredths < 0 THEN
    RAISE EXCEPTION 'a request cannot cost less than nothing'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.ocade_commercial_usage (
    user_id, window_kind, window_start, used_hundredths
  )
  VALUES (p_user_id, p_window_kind, p_window_start, p_cost_hundredths)
  ON CONFLICT (user_id, window_kind, window_start)
  DO UPDATE SET
    used_hundredths = public.ocade_commercial_usage.used_hundredths + p_cost_hundredths
  RETURNING used_hundredths INTO v_used;

  -- Asked only past the limit, so nobody else pays for the question.
  IF p_limit_hundredths IS NOT NULL AND v_used > p_limit_hundredths
     AND NOT EXISTS (SELECT 1 FROM private.ocade_usage_unlimited(p_user_id)) THEN
    RAISE EXCEPTION 'allowance_exhausted' USING ERRCODE = 'check_violation';
  END IF;

  RETURN v_used;
END;
$$;

ALTER TABLE public.ocade_admin_actions DROP CONSTRAINT IF EXISTS ocade_admin_actions_action_check;
ALTER TABLE public.ocade_admin_actions ADD CONSTRAINT ocade_admin_actions_action_check CHECK (action IN (
  'remove_device', 'owner_bootstrap', 'owner_transfer', 'staff_grant', 'staff_invite',
  'staff_invite_withdrawn', 'staff_invite_accepted', 'staff_permissions', 'staff_revoke',
  'staff_sessions_ended', 'customer_sessions_ended', 'case_open', 'case_close', 'case_read',
  'second_factor_reset', 'usage_adjusted', 'account_suspended', 'account_restored',
  'account_deletion_started', 'account_deleted', 'unlimited_granted', 'unlimited_revoked'));

-- Only an owner gives unlimited use, with a recent code, a reason, and an audit line.
CREATE OR REPLACE FUNCTION private.ocade_owner_require(p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM private.ocade_staff_require('grants.manage', p_action);
  IF private.ocade_staff_role_of(auth.uid()) IS DISTINCT FROM 'primary_owner'
     AND private.ocade_staff_role_of(auth.uid()) IS DISTINCT FROM 'backup_owner' THEN
    RAISE EXCEPTION 'Only an owner changes unlimited use.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.ocade_owner_require(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ocade_grant_unlimited(p_user uuid, p_until timestamptz, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_reason text := private.ocade_require_reason(p_reason);
  v_id uuid;
BEGIN
  PERFORM private.ocade_owner_require('give unlimited use');
  IF p_user = auth.uid() THEN
    RAISE EXCEPTION 'Nobody grants themselves.' USING ERRCODE = '42501';
  END IF;
  IF private.ocade_staff_role_of(p_user) IN ('primary_owner', 'backup_owner') THEN
    RAISE EXCEPTION 'An owner already has unlimited use.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'No such account.' USING ERRCODE = 'P0002';
  END IF;
  IF p_until IS NOT NULL
     AND (p_until < now() + interval '5 minutes' OR p_until > now() + interval '3660 days') THEN
    RAISE EXCEPTION 'End it between five minutes and ten years from now, or not at all.'
      USING ERRCODE = '22023';
  END IF;
  UPDATE public.ocade_unlimited_grants
     SET revoked_at = now(), revoked_by = auth.uid(), revoke_reason = 'Replaced by a new grant.'
   WHERE user_id = p_user AND revoked_at IS NULL;
  INSERT INTO public.ocade_unlimited_grants (user_id, granted_by, reason, ends_at)
  VALUES (p_user, auth.uid(), v_reason, p_until)
  RETURNING id INTO v_id;
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (auth.uid(), p_user, 'unlimited_granted',
          v_reason || CASE WHEN p_until IS NULL THEN ' (until revoked)'
                           ELSE ' (until ' || to_char(p_until AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC)' END);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_revoke_unlimited(p_user uuid, p_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_reason text := private.ocade_require_reason(p_reason);
BEGIN
  PERFORM private.ocade_owner_require('end unlimited use');
  UPDATE public.ocade_unlimited_grants
     SET revoked_at = now(), revoked_by = auth.uid(), revoke_reason = v_reason
   WHERE user_id = p_user AND revoked_at IS NULL;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (auth.uid(), p_user, 'unlimited_revoked', v_reason);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.ocade_grant_unlimited(uuid, timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_revoke_unlimited(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_grant_unlimited(uuid, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_revoke_unlimited(uuid, text) TO authenticated;

-- 3. Handing over ownership --------------------------------------------------------

DROP FUNCTION IF EXISTS public.ocade_staff_transfer_ownership(uuid, text);
CREATE FUNCTION public.ocade_staff_transfer_ownership(p_to uuid, p_reason text, p_stay_owner boolean DEFAULT true)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  PERFORM private.ocade_staff_require('staff.manage', 'hand over ownership');
  IF private.ocade_staff_role_of(v_me) <> 'primary_owner' THEN
    RAISE EXCEPTION 'Only the Primary Owner hands over ownership.' USING ERRCODE = '42501';
  END IF;
  -- To a verified account that is already an Owner: two deliberate steps, never one slip.
  IF private.ocade_staff_role_of(p_to) IS DISTINCT FROM 'backup_owner' THEN
    RAISE EXCEPTION 'Ownership goes to an Owner. Make them an Owner first.' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.ocade_staff SET role = 'backup_owner', updated_at = now() WHERE user_id = v_me;
  UPDATE public.ocade_staff SET role = 'primary_owner', denied = '{}', updated_at = now()
   WHERE user_id = p_to;
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (v_me, p_to, 'owner_transfer', btrim(p_reason));
  IF NOT COALESCE(p_stay_owner, true) THEN
    DELETE FROM public.ocade_staff WHERE user_id = v_me;
    INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
    VALUES (v_me, v_me, 'staff_revoke', 'Left the staff when handing over ownership.');
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_staff_transfer_ownership(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_staff_transfer_ownership(uuid, text, boolean) TO authenticated;

COMMIT;
