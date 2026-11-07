-- Restores the staff device removal as of before 20261107094238.
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
  IF NOT private.ocade_staff_has('devices.manage') THEN
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
$function$
;

REVOKE ALL ON FUNCTION public.ocade_admin_remove_device(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_admin_remove_device(uuid, text) TO authenticated, service_role;
COMMIT;
