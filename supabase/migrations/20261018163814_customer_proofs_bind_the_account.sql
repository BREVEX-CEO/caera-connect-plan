-- Phase 08 SEC-08-01: the spent confirmation names its customer, even through the Data API.
-- Forward repair only: keep existing MFA, permissions, transactions, signatures and ACLs.
BEGIN;
CREATE OR REPLACE FUNCTION private.ocade_staff_require(p_permission text, p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_session uuid := NULLIF(auth.jwt() ->> 'session_id', '')::uuid;
  v_proved bigint;
  -- Match assurance.proofAction: Unicode characters, plus a digest of the entire action.
  v_action text := CASE WHEN length(p_action) > 120
    THEN left(p_action, 55) || ':' || encode(sha256(convert_to(p_action, 'UTF8')), 'hex')
    ELSE p_action END;
BEGIN
  PERFORM private.ocade_staff_check(p_permission, p_action);
  SELECT max((entry ->> 'timestamp')::bigint) INTO v_proved
    FROM jsonb_array_elements(COALESCE(auth.jwt() -> 'amr', '[]'::jsonb)) AS entry;
  IF v_session IS NULL OR v_proved IS NULL THEN
    RAISE EXCEPTION 'Confirm it is you again: each confirmation covers one change.'
      USING ERRCODE = '42501';
  END IF;
  -- The change OCADE's server just spent this proof on (that same change: its action is
  -- compared), or a nested step of this same change.
  UPDATE private.ocade_spent_proofs
     SET changed_in = pg_current_xact_id()
   WHERE session_id = v_session AND proved_at = v_proved
     AND (changed_in = pg_current_xact_id()
          OR (changed_in IS NULL AND spent_at > now() - interval '1 minute'
              AND action = v_action));
  IF FOUND THEN
    RETURN;
  END IF;
  -- Called directly with a proof nothing has spent yet: this change spends it.
  INSERT INTO private.ocade_spent_proofs
    (session_id, proved_at, user_id, action, target_digest, changed_in)
  VALUES (v_session, v_proved, auth.uid(), left('database: ' || p_action, 120),
          encode(sha256(convert_to(p_action, 'UTF8')), 'hex'), pg_current_xact_id())
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Confirm it is you again: each confirmation covers one change.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.ocade_staff_require(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ocade_staff_end_customer_sessions(p_user uuid, p_reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_removed integer;
BEGIN
  PERFORM private.ocade_staff_require('sessions.manage', 'end a customer''s sessions: ' || p_user);
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  IF private.ocade_staff_role_of(p_user) IN ('primary_owner', 'backup_owner') THEN
    RAISE EXCEPTION 'An owner''s sessions are ended by the owner.' USING ERRCODE = '42501';
  END IF;
  -- Another member of staff is an owner's to act on, never a colleague's.
  IF private.ocade_staff_role_of(p_user) IS NOT NULL
     AND private.ocade_staff_role_of(auth.uid()) NOT IN ('primary_owner', 'backup_owner') THEN
    RAISE EXCEPTION 'A member of staff is changed by an owner.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM auth.sessions WHERE user_id = p_user;
  GET DIAGNOSTICS v_removed = ROW_COUNT;
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (auth.uid(), p_user, 'customer_sessions_ended', btrim(p_reason));
  RETURN v_removed;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_staff_reset_second_factor(p_user uuid, p_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM private.ocade_staff_require('sessions.manage', 'turn off a customer''s two-step verification: ' || p_user);
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  IF p_user = auth.uid() THEN
    RAISE EXCEPTION 'Nobody turns off their own two-step verification this way.' USING ERRCODE = '42501';
  END IF;
  IF private.ocade_staff_role_of(p_user) IN ('primary_owner', 'backup_owner') THEN
    RAISE EXCEPTION 'An owner''s two-step verification is changed by the owner.' USING ERRCODE = '42501';
  END IF;
  -- Another member of staff is an owner's to act on, never a colleague's.
  IF private.ocade_staff_role_of(p_user) IS NOT NULL
     AND private.ocade_staff_role_of(auth.uid()) NOT IN ('primary_owner', 'backup_owner') THEN
    RAISE EXCEPTION 'A member of staff is changed by an owner.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user) THEN
    RETURN false;
  END IF;
  DELETE FROM auth.sessions WHERE user_id = p_user;
  DELETE FROM public.ocade_mfa_recovery_codes WHERE user_id = p_user;
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (auth.uid(), p_user, 'second_factor_reset', btrim(p_reason));
  RETURN true;
END;
$$;

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
  PERFORM private.ocade_staff_require('usage.manage', 'change a customer''s usage: ' || p_user);
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
    -- Relative to what is there at write time, so a use counted meanwhile is never overwritten.
    DO UPDATE SET used_hundredths = GREATEST(0, public.ocade_commercial_usage.used_hundredths + p_delta_hundredths),
                  updated_at = now()
  RETURNING used_hundredths INTO v_after;
  INSERT INTO public.ocade_usage_adjustments
    (user_id, actor, surface, window_kind, window_start, delta_hundredths, used_before, used_after, reason)
  VALUES (p_user, auth.uid(), p_surface, p_window_kind, v_start, p_delta_hundredths, v_before, v_after, v_reason);
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (auth.uid(), p_user, 'usage_adjusted', v_reason);
  RETURN v_after;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_staff_suspend_account(p_user uuid, p_suspend boolean, p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_reason text := private.ocade_require_reason(p_reason);
BEGIN
  PERFORM private.ocade_staff_require('accounts.manage',
    (CASE WHEN p_suspend THEN 'suspend an account' ELSE 'restore an account' END) || ': ' || p_user);
  PERFORM private.ocade_staff_may_act_on(p_user, 'suspend');
  IF p_suspend THEN
    PERFORM private.ocade_stop_account(p_user);
  ELSIF EXISTS (SELECT 1 FROM public.ocade_admin_actions
                 WHERE target_user = p_user AND action = 'account_deletion_started') THEN
    -- Half erased is not an account to hand back: its deletion is finished instead.
    RAISE EXCEPTION 'This account''s deletion was started. Finish deleting it.' USING ERRCODE = '42501';
  ELSE
    UPDATE auth.users SET banned_until = NULL WHERE id = p_user;
  END IF;
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (auth.uid(), p_user, CASE WHEN p_suspend THEN 'account_suspended' ELSE 'account_restored' END,
          v_reason);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_staff_begin_account_deletion(p_user uuid, p_email text, p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_reason text := private.ocade_require_reason(p_reason);
BEGIN
  PERFORM private.ocade_staff_require('accounts.delete', 'delete an account: ' || p_user);
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
COMMIT;
