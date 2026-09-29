-- The owner can remove a customer's JARVIS device (docs/OWNER_ADMIN_BACKEND.md,
-- Customer management: "remove devices"). The same effect as the customer's own
-- Forget: open tasks on it stop, nothing queued for it runs, and its key is
-- gone so it can never sign another request. Every removal needs a support
-- admin, a recent second factor and a written reason, and is kept in an
-- append-only record of operator actions.
BEGIN;

CREATE TABLE IF NOT EXISTS public.ocade_admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  subject uuid,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ocade_admin_actions_action_check CHECK (action IN ('remove_device')),
  CONSTRAINT ocade_admin_actions_reason_check CHECK (length(btrim(reason)) BETWEEN 10 AND 500)
);
CREATE INDEX IF NOT EXISTS ocade_admin_actions_target
  ON public.ocade_admin_actions (target_user, created_at DESC);
CREATE INDEX IF NOT EXISTS ocade_admin_actions_actor ON public.ocade_admin_actions (actor);

ALTER TABLE public.ocade_admin_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ocade_admin_actions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ocade_admin_actions TO service_role;

CREATE OR REPLACE FUNCTION public.ocade_admin_remove_device(device uuid, remove_reason text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
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
$$;
REVOKE ALL ON FUNCTION public.ocade_admin_remove_device(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_admin_remove_device(uuid, text)
  TO authenticated, service_role;

COMMIT;
