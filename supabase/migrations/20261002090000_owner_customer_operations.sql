-- Owner Console customer operations (owner addendum 2026-10-02): usage given back or
-- charged through an append-only record, an account suspended and restored, and an
-- account deletion begun by an owner. Each is a staff permission, needs the caller's
-- second factor and recent proof, says why, and is audited. Owners are acted on by
-- owners only, and nobody acts on themselves this way.

-- 1. Three permissions -------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.ocade_known_permissions()
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path TO ''
AS $$ SELECT ARRAY['customers.read', 'usage.read', 'devices.read', 'devices.manage', 'tasks.read',
  'security.read', 'sessions.manage', 'grants.manage', 'execution.manage', 'health.read',
  'audit.read', 'staff.manage', 'cases.read', 'cases.manage',
  'usage.manage', 'accounts.manage', 'accounts.delete'] $$;

CREATE OR REPLACE FUNCTION private.ocade_role_permissions(p_role text)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path TO ''
AS $$
  SELECT CASE p_role
    WHEN 'primary_owner' THEN private.ocade_known_permissions()
    WHEN 'backup_owner' THEN private.ocade_known_permissions()
    WHEN 'admin' THEN ARRAY['customers.read', 'usage.read', 'devices.read', 'devices.manage', 'tasks.read',
      'security.read', 'sessions.manage', 'grants.manage', 'execution.manage', 'health.read', 'audit.read',
      'cases.read', 'usage.manage', 'accounts.manage']
    WHEN 'support' THEN ARRAY['customers.read', 'devices.read', 'tasks.read', 'cases.read']
    WHEN 'billing' THEN ARRAY['customers.read', 'usage.read', 'grants.manage', 'usage.manage']
    WHEN 'operations' THEN ARRAY['devices.read', 'devices.manage', 'tasks.read', 'health.read', 'execution.manage']
    WHEN 'read_only' THEN ARRAY['customers.read', 'usage.read', 'devices.read', 'tasks.read', 'health.read', 'audit.read']
    ELSE ARRAY[]::text[]
  END;
$$;

ALTER TABLE public.ocade_admin_actions DROP CONSTRAINT IF EXISTS ocade_admin_actions_action_check;
ALTER TABLE public.ocade_admin_actions ADD CONSTRAINT ocade_admin_actions_action_check CHECK (action IN (
  'remove_device', 'owner_bootstrap', 'owner_transfer', 'staff_grant', 'staff_invite',
  'staff_invite_withdrawn', 'staff_invite_accepted', 'staff_permissions', 'staff_revoke',
  'staff_sessions_ended', 'customer_sessions_ended', 'case_open', 'case_close', 'case_read',
  'second_factor_reset', 'usage_adjusted', 'account_suspended', 'account_restored',
  'account_deletion_started', 'account_deleted'));

-- 2. Who may be acted on -------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.ocade_staff_may_act_on(p_user uuid, p_what text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF p_user = auth.uid() THEN
    RAISE EXCEPTION 'Nobody does this to their own account.' USING ERRCODE = '42501';
  END IF;
  IF private.ocade_staff_role_of(p_user) IN ('primary_owner', 'backup_owner') THEN
    RAISE EXCEPTION 'An owner''s account is changed by the owner.' USING ERRCODE = '42501';
  END IF;
  IF private.ocade_staff_role_of(p_user) IS NOT NULL
     AND private.ocade_staff_role_of(auth.uid()) NOT IN ('primary_owner', 'backup_owner') THEN
    RAISE EXCEPTION 'A member of staff is changed by an owner.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user) THEN
    RAISE EXCEPTION 'No such account.' USING ERRCODE = 'P0002';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.ocade_staff_may_act_on(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.ocade_require_reason(p_reason text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO ''
AS $$
BEGIN
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  RETURN btrim(p_reason);
END;
$$;
REVOKE ALL ON FUNCTION private.ocade_require_reason(text) FROM PUBLIC, anon, authenticated;

-- 3. Usage given back or charged, append-only ----------------------------------------

CREATE TABLE IF NOT EXISTS public.ocade_usage_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  surface text NOT NULL CHECK (surface IN ('chat', 'jarvis')),
  window_kind text NOT NULL CHECK (window_kind IN ('session', 'week')),
  window_start timestamptz NOT NULL,
  delta_hundredths bigint NOT NULL CHECK (delta_hundredths <> 0 AND abs(delta_hundredths) <= 100000),
  used_before bigint NOT NULL,
  used_after bigint NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 10 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ocade_usage_adjustments_user_idx
  ON public.ocade_usage_adjustments (user_id, created_at DESC);
ALTER TABLE public.ocade_usage_adjustments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ocade_usage_adjustments FROM PUBLIC, anon, authenticated;
-- Read by the console's server; written only by the function below; never changed.
REVOKE ALL ON TABLE public.ocade_usage_adjustments FROM service_role;
GRANT SELECT ON TABLE public.ocade_usage_adjustments TO service_role;

CREATE OR REPLACE FUNCTION public.ocade_staff_adjust_usage(
  p_user uuid, p_surface text, p_window_kind text, p_delta_hundredths bigint, p_reason text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_reason text := private.ocade_require_reason(p_reason);
  v_start timestamptz;
  v_kind text;
  v_before bigint;
  v_after bigint;
BEGIN
  PERFORM private.ocade_staff_require('usage.manage', 'change a customer''s usage');
  PERFORM private.ocade_staff_may_act_on(p_user, 'usage');
  IF p_surface NOT IN ('chat', 'jarvis') OR p_window_kind NOT IN ('session', 'week') THEN
    RAISE EXCEPTION 'Choose Chat or JARVIS, and this session or this week.' USING ERRCODE = '22023';
  END IF;
  IF p_delta_hundredths IS NULL OR p_delta_hundredths = 0 OR abs(p_delta_hundredths) > 100000 THEN
    RAISE EXCEPTION 'Change usage by between one hundredth and a thousand uses.' USING ERRCODE = '22023';
  END IF;
  -- The window the customer is in now, as their own usage screen reads it.
  SELECT u.window_start INTO v_start
    FROM public.ocade_read_commercial_usage(p_user, p_surface) u WHERE u.window_kind = p_window_kind;
  v_kind := public.ocade_usage_window_kind(p_surface, p_window_kind);
  SELECT c.used_hundredths INTO v_before FROM public.ocade_commercial_usage c
   WHERE c.user_id = p_user AND c.window_kind = v_kind AND c.window_start = v_start FOR UPDATE;
  v_before := COALESCE(v_before, 0);
  v_after := GREATEST(0, v_before + p_delta_hundredths);
  INSERT INTO public.ocade_commercial_usage (user_id, window_kind, window_start, used_hundredths)
  VALUES (p_user, v_kind, v_start, v_after)
  ON CONFLICT (user_id, window_kind, window_start)
    DO UPDATE SET used_hundredths = EXCLUDED.used_hundredths, updated_at = now();
  INSERT INTO public.ocade_usage_adjustments
    (user_id, actor, surface, window_kind, window_start, delta_hundredths, used_before, used_after, reason)
  VALUES (p_user, auth.uid(), p_surface, p_window_kind, v_start, p_delta_hundredths, v_before, v_after, v_reason);
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (auth.uid(), p_user, 'usage_adjusted', v_reason);
  RETURN v_after;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_staff_adjust_usage(uuid, text, text, bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_staff_adjust_usage(uuid, text, text, bigint, text) TO authenticated;

-- 4. Suspend and restore -------------------------------------------------------------

-- Everything that lets an account act stops at once: sign-in (Supabase Auth's own ban),
-- every session, every paired computer and phone, open JARVIS work and scheduled work.
CREATE OR REPLACE FUNCTION private.ocade_stop_account(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  UPDATE auth.users SET banned_until = now() + interval '100 years' WHERE id = p_user;
  DELETE FROM auth.sessions WHERE user_id = p_user;
  UPDATE public.jarvis_devices SET revoked_at = now(), public_key = NULL
   WHERE user_id = p_user AND revoked_at IS NULL;
  UPDATE public.jarvis_tasks SET status = 'stopped', blocker = 'The account was suspended.'
   WHERE user_id = p_user AND status IN ('running', 'waiting', 'taken_over');
  UPDATE public.jarvis_activity SET status = 'cancelled', completed_at = now()
   WHERE user_id = p_user AND status IN ('queued', 'needs_confirmation', 'claimed');
  UPDATE public.jarvis_schedules SET active = false WHERE user_id = p_user AND active;
END;
$$;
REVOKE ALL ON FUNCTION private.ocade_stop_account(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ocade_staff_suspend_account(p_user uuid, p_suspend boolean, p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_reason text := private.ocade_require_reason(p_reason);
BEGIN
  PERFORM private.ocade_staff_require('accounts.manage',
    CASE WHEN p_suspend THEN 'suspend an account' ELSE 'restore an account' END);
  PERFORM private.ocade_staff_may_act_on(p_user, 'suspend');
  IF p_suspend THEN
    PERFORM private.ocade_stop_account(p_user);
  ELSE
    UPDATE auth.users SET banned_until = NULL WHERE id = p_user;
  END IF;
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (auth.uid(), p_user, CASE WHEN p_suspend THEN 'account_suspended' ELSE 'account_restored' END,
          v_reason);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_staff_suspend_account(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_staff_suspend_account(uuid, boolean, text) TO authenticated;

-- 5. An owner begins an account's deletion -----------------------------------------
-- The account is stopped first (as a suspension), so nothing writes behind the erasure;
-- the console's server then erases its data and its sign-in exactly as the customer's
-- own deletion does. Staff accounts lose their role before they can be deleted.
CREATE OR REPLACE FUNCTION public.ocade_staff_begin_account_deletion(p_user uuid, p_email text, p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_reason text := private.ocade_require_reason(p_reason);
BEGIN
  PERFORM private.ocade_staff_require('accounts.delete', 'delete an account');
  PERFORM private.ocade_staff_may_act_on(p_user, 'delete');
  IF private.ocade_staff_role_of(p_user) IS NOT NULL THEN
    RAISE EXCEPTION 'Remove their staff role before deleting the account.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user
                  AND lower(u.email) = lower(btrim(COALESCE(p_email, '')))) THEN
    RAISE EXCEPTION 'Type the account''s email address exactly to delete it.' USING ERRCODE = '22023';
  END IF;
  PERFORM private.ocade_stop_account(p_user);
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (auth.uid(), p_user, 'account_deletion_started', v_reason);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_staff_begin_account_deletion(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_staff_begin_account_deletion(uuid, text, text) TO authenticated;
