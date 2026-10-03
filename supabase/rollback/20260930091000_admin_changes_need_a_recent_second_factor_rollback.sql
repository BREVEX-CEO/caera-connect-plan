-- Back to the aal2-only check for operator changes.
BEGIN;

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

COMMIT;
