-- Undo the single staff authority: operators return to user_roles 'admin',
-- has_role and the support-admin check read user_roles again, the four operator
-- RPCs go back to the admin check, and the staff, invite and case tables go.
-- The audit record of what staff did is kept.
BEGIN;

INSERT INTO public.user_roles (user_id, role)
SELECT s.user_id, 'admin'::public.app_role FROM public.ocade_staff AS s
 WHERE s.role IN ('primary_owner', 'backup_owner', 'admin')
ON CONFLICT DO NOTHING;

DROP TRIGGER IF EXISTS ocade_accept_staff_invite ON auth.users;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
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
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid()) AND role = 'admin'::public.app_role
  );
$$;

CREATE OR REPLACE FUNCTION public.ocade_admin_remove_device(device uuid, remove_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  owner_id uuid;
BEGIN
  IF NOT private.ocade_is_support_admin() THEN
    RAISE EXCEPTION 'Only support admins may remove a device.' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(current_setting('request.jwt.claim.aal', true),
              (current_setting('request.jwt.claims', true)::json ->> 'aal')) IS DISTINCT FROM 'aal2' THEN
    RAISE EXCEPTION 'Removing a device needs a recent second factor.' USING ERRCODE = '42501';
  END IF;
  PERFORM public.ocade_require_recent_strong_auth('removing a device');
  IF remove_reason IS NULL OR length(btrim(remove_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.jarvis_devices
     SET revoked_at = now(), public_key = NULL
   WHERE id = device AND revoked_at IS NULL
  RETURNING user_id INTO owner_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.jarvis_tasks
     SET status = 'stopped', blocker = 'The device was removed.'
   WHERE device_id = device AND status IN ('running', 'waiting', 'taken_over');
  UPDATE public.jarvis_activity
     SET status = 'cancelled', completed_at = now()
   WHERE device_id = device AND status IN ('queued', 'needs_confirmation', 'claimed');

  INSERT INTO public.ocade_admin_actions (actor, target_user, action, subject, reason)
  VALUES ((SELECT auth.uid()), owner_id, 'remove_device', device, btrim(remove_reason));
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ocade_grant_entitlement(target_user uuid, grant_tier text, grant_reason text, days integer DEFAULT 30)
 RETURNS ocade_entitlement_grants
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  created public.ocade_entitlement_grants;
BEGIN
  IF NOT private.ocade_is_support_admin() THEN
    RAISE EXCEPTION 'Only support admins may grant an entitlement.' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(current_setting('request.jwt.claim.aal', true),
              (current_setting('request.jwt.claims', true)::json ->> 'aal')) IS DISTINCT FROM 'aal2' THEN
    RAISE EXCEPTION 'Granting an entitlement needs a recent second factor.' USING ERRCODE = '42501';
  END IF;
  PERFORM public.ocade_require_recent_strong_auth('granting access');

  IF days IS NULL OR days < 1 OR days > 366 THEN
    RAISE EXCEPTION 'A grant runs for between 1 and 366 days.' USING ERRCODE = '22023';
  END IF;

  /*
   * NOBODY GRANTS THEMSELVES. An admin who needs Pro on their own account asks
   * another admin, exactly as they would for any other privileged change, and
   * the record then shows two people rather than one.
   */
  IF target_user = (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'An entitlement cannot be granted to the account granting it.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.ocade_entitlement_grants (user_id, granted_by, tier, reason, ends_at)
  VALUES (target_user, (SELECT auth.uid()), grant_tier, grant_reason,
          now() + make_interval(days => days))
  RETURNING * INTO created;

  RETURN created;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ocade_revoke_entitlement(grant_id uuid, revoke_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  affected INTEGER;
BEGIN
  IF NOT private.ocade_is_support_admin() THEN
    RAISE EXCEPTION 'Only support admins may revoke an entitlement.' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(current_setting('request.jwt.claim.aal', true),
              (current_setting('request.jwt.claims', true)::json ->> 'aal')) IS DISTINCT FROM 'aal2' THEN
    RAISE EXCEPTION 'Revoking an entitlement needs a recent second factor.' USING ERRCODE = '42501';
  END IF;
  PERFORM public.ocade_require_recent_strong_auth('revoking access');

  UPDATE public.ocade_entitlement_grants
     SET revoked_at = now(),
         revoked_by = (SELECT auth.uid()),
         revoked_reason = revoke_reason
   WHERE id = grant_id
     AND revoked_at IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ocade_set_service_control(control_key text, pause boolean, change_reason text)
 RETURNS ocade_service_controls
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  changed public.ocade_service_controls;
BEGIN
  IF NOT private.ocade_is_support_admin() THEN
    RAISE EXCEPTION 'Only support admins may change a service control.' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(current_setting('request.jwt.claim.aal', true),
              (current_setting('request.jwt.claims', true)::json ->> 'aal')) IS DISTINCT FROM 'aal2' THEN
    RAISE EXCEPTION 'Changing a service control needs a recent second factor.' USING ERRCODE = '42501';
  END IF;
  PERFORM public.ocade_require_recent_strong_auth('changing a service control');
  IF change_reason IS NULL OR length(btrim(change_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.ocade_service_controls
     SET paused = pause, reason = btrim(change_reason),
         changed_by = (SELECT auth.uid()), changed_at = now()
   WHERE key = control_key
  RETURNING * INTO changed;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown service control.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.ocade_service_control_events (key, paused, reason, changed_by)
  VALUES (control_key, pause, btrim(change_reason), (SELECT auth.uid()));
  RETURN changed;
END;
$function$;


CREATE OR REPLACE FUNCTION public.ocade_read_service_controls()
RETURNS SETOF public.ocade_service_controls
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT private.ocade_is_support_admin() THEN
    RAISE EXCEPTION 'Only support admins may read service controls.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.ocade_service_controls ORDER BY key;
END;
$$;

DROP POLICY IF EXISTS entitlement_grants_admin_read ON public.ocade_entitlement_grants;
CREATE POLICY entitlement_grants_admin_read ON public.ocade_entitlement_grants
  FOR SELECT TO authenticated USING (private.ocade_is_support_admin());

DROP FUNCTION IF EXISTS public.ocade_bootstrap_primary_owner(text);
DROP FUNCTION IF EXISTS public.ocade_case_messages(uuid, uuid);
DROP FUNCTION IF EXISTS public.ocade_case_close(uuid, text);
DROP FUNCTION IF EXISTS public.ocade_case_open(uuid, text, integer);
DROP FUNCTION IF EXISTS public.ocade_staff_end_customer_sessions(uuid, text);
DROP FUNCTION IF EXISTS public.ocade_staff_end_all_sessions(text);
DROP FUNCTION IF EXISTS public.ocade_staff_transfer_ownership(uuid, text);
DROP FUNCTION IF EXISTS public.ocade_staff_withdraw_invite(uuid, text);
DROP FUNCTION IF EXISTS public.ocade_staff_revoke(uuid, text);
DROP FUNCTION IF EXISTS public.ocade_staff_set_permissions(uuid, text[], text[], text);
DROP FUNCTION IF EXISTS public.ocade_staff_grant(text, text, text);
DROP FUNCTION IF EXISTS private.ocade_accept_staff_invite();
DROP FUNCTION IF EXISTS private.ocade_staff_role_of(uuid);
DROP FUNCTION IF EXISTS private.ocade_staff_require(text, text);
DROP FUNCTION IF EXISTS public.ocade_staff_role_defaults();
DROP FUNCTION IF EXISTS public.ocade_my_staff();
DROP FUNCTION IF EXISTS public.ocade_staff_can(text);
DROP FUNCTION IF EXISTS private.ocade_staff_has(text);

-- The audit record is kept, and so is the wider list of action names it needs:
-- a rollback must never erase what was done while the change was live.

DROP TABLE IF EXISTS public.ocade_support_cases;
DROP TABLE IF EXISTS public.ocade_staff_invites;
DROP TABLE IF EXISTS public.ocade_staff;
DROP FUNCTION IF EXISTS private.ocade_known_permissions();
DROP FUNCTION IF EXISTS private.ocade_role_permissions(text);

COMMIT;
